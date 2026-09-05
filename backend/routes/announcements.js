const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  Announcement,
  AnnouncementRecipient,
  Beneficiary,
  Enrollment,
  Notification,
  SMSNotification,
  AuditLog,
  User,
  BenefitProgram,
  Barangay,
  Attendance,
} = require('../db');
const { isMswdoRole } = require('../utils/roles');

const router = express.Router();
router.use(authenticate);

// Helper function to safely parse target_barangays input into an array of numeric IDs
function parseTargetBarangayIds(input) {
  if (!input) return [];
  let bIds = [];
  if (typeof input === 'string') {
    try { bIds = JSON.parse(input); } catch (e) { bIds = [input]; }
  } else if (Array.isArray(input)) {
    bIds = input;
  } else {
    bIds = [input];
  }
  if (!Array.isArray(bIds)) bIds = [bIds];
  return bIds.map(Number).filter(id => !isNaN(id) && id > 0);
}

// Helper function to find target matching beneficiaries directly by Barangay & Category (Approved beneficiaries)
async function getMatchingBeneficiaries(targetCategoriesOrPrograms, barangayIdsInput) {
  let catList = [];
  if (typeof targetCategoriesOrPrograms === 'string') {
    try { catList = JSON.parse(targetCategoriesOrPrograms); } catch (e) { catList = [targetCategoriesOrPrograms]; }
  } else if (Array.isArray(targetCategoriesOrPrograms)) {
    catList = targetCategoriesOrPrograms;
  }

  let categories = [];
  let programIds = [];
  catList.forEach(item => {
    if (typeof item === 'number' || (!isNaN(item) && !isNaN(parseFloat(item)) && String(Number(item)) === String(item))) {
      programIds.push(Number(item));
    } else if (typeof item === 'string') {
      categories.push(item);
    }
  });

  // Only resolve categories from program IDs if NO direct string categories were provided
  if (categories.length === 0 && programIds.length > 0) {
    const progs = await BenefitProgram.findAll({
      where: { id: programIds },
      attributes: ['eligibility_category', 'category'],
      raw: true,
    });
    progs.forEach(p => {
      if (p.eligibility_category) categories.push(p.eligibility_category);
      if (p.category) categories.push(p.category);
    });
  }

  let bIds = parseTargetBarangayIds(barangayIdsInput);

  if (bIds.length === 0) {
    return [];
  }

  // Build category match filters strictly based on selected category names
  const categoryConditions = [];
  categories.forEach(cat => {
    const norm = String(cat).toLowerCase();
    if (norm.includes('4ps')) {
      categoryConditions.push({ category: { [Op.like]: '%4Ps%' } });
    } else if (norm.includes('senior')) {
      categoryConditions.push({ category: { [Op.like]: '%Senior%' } });
    } else if (norm.includes('pwd') || norm.includes('disabil')) {
      categoryConditions.push({ category: { [Op.like]: '%PWD%' } });
      categoryConditions.push({ category: { [Op.like]: '%Disabilit%' } });
    } else if (cat) {
      categoryConditions.push({ category: { [Op.like]: `%${cat}%` } });
    }
  });

  // DIRECT QUERY: Find all active (Approved) beneficiaries per barangay and category
  const whereClause = {
    status: 'Approved',
    barangay_id: { [Op.in]: bIds },
  };

  if (categoryConditions.length > 0) {
    whereClause[Op.or] = categoryConditions;
  }

  const matchingBeneficiaries = await Beneficiary.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        attributes: ['id', 'email', 'contact_number', 'first_name', 'last_name'],
      },
      {
        model: Barangay,
        attributes: ['id', 'barangay_name'],
      },
    ],
  });

  return matchingBeneficiaries;
}

// Helper to dispatch notifications for an announcement (Beneficiaries + Barangay Staff)
async function dispatchAnnouncementNotifications(announcement, adminUserId) {
  const matchingBeneficiaries = await getMatchingBeneficiaries(
    announcement.target_programs,
    announcement.target_barangays
  );

  const matchingBeneficiaryIds = matchingBeneficiaries.map(b => b.id);
  const matchingUserIds = matchingBeneficiaries.map(b => b.user_id).filter(Boolean);

  // Clean up any old recipient links & in-app notifications for beneficiaries who no longer match
  await AnnouncementRecipient.destroy({
    where: {
      announcement_id: announcement.id,
      beneficiary_id: { [Op.notIn]: matchingBeneficiaryIds.length > 0 ? matchingBeneficiaryIds : [0] },
    },
  });

  await Notification.destroy({
    where: {
      reference_id: announcement.id,
      reference_type: 'announcement',
      user_id: { [Op.notIn]: matchingUserIds.length > 0 ? matchingUserIds : [0] },
    },
  });

  if (matchingBeneficiaries.length === 0) {
    await announcement.update({ recipient_count: 0 });
  } else {
    // Prepare AnnouncementRecipient records (deduplicated by beneficiary_id)
    const recipientRecords = [];
    const inAppNotifications = [];
    const smsNotifications = [];

    for (const b of matchingBeneficiaries) {
      recipientRecords.push({
        announcement_id: announcement.id,
        beneficiary_id: b.id,
        user_id: b.user_id,
        is_read: false,
        attendance_status: 'Pending',
        notification_sent: true,
        sms_sent: !!b.contact_number,
      });

      const formattedTime = `${announcement.event_time || ''}${announcement.end_time ? ` - ${announcement.end_time}` : ''}`.trim();
      const schedText = announcement.event_date ? `Date: ${announcement.event_date}${formattedTime ? ` at ${formattedTime}` : ''}` : '';

      inAppNotifications.push({
        user_id: b.user_id,
        title: announcement.title,
        message: `${announcement.message}${schedText ? `\n\n📅 ${schedText}` : ''}${announcement.venue ? `\n📍 Venue: ${announcement.venue}` : ''}`,
        type: 'announcement',
        reference_id: announcement.id,
        reference_type: 'announcement',
        is_read: false,
      });

      if (b.contact_number) {
        smsNotifications.push({
          beneficiary_id: b.id,
          phone_number: b.contact_number,
          message: `[EBMS ANNOUNCEMENT] ${announcement.title}: ${announcement.message.substring(0, 90)}... ${schedText}`,
          status: 'sent',
          sent_at: new Date(),
        });
      }
    }

    // Bulk create using findOrCreate pattern
    for (const record of recipientRecords) {
      await AnnouncementRecipient.findOrCreate({
        where: {
          announcement_id: record.announcement_id,
          beneficiary_id: record.beneficiary_id,
        },
        defaults: record,
      });
    }

    if (inAppNotifications.length > 0) {
      await Notification.bulkCreate(inAppNotifications, { ignoreDuplicates: true });
    }

    if (smsNotifications.length > 0) {
      await SMSNotification.bulkCreate(smsNotifications, { ignoreDuplicates: true });
    }

    const recipientCount = matchingBeneficiaries.length;
    await announcement.update({ recipient_count: recipientCount });
  }

  // NOTIFY ONLY ASSIGNED BARANGAY STAFF (NOT ADMIN)
  const targetBarangayIds = parseTargetBarangayIds(announcement.target_barangays);
  
  // CRITICAL: Only notify barangay staff assigned to EXACTLY the target barangays
  // Staff from other barangays MUST NOT receive notifications
  const staffUsers = targetBarangayIds.length > 0 ? await User.findAll({
    where: {
      role: { [Op.in]: ['staff','barangay'] }, // Exclude 'admin' role
      status: 'active',
      barangay_id: { 
        [Op.in]: targetBarangayIds, // Only staff whose barangay_id matches target barangays
        [Op.ne]: null, // Exclude users with null barangay_id
      },
    },
  }) : [];

  const targetStaffUserIds = staffUsers.map((s) => s.id);

  // Clean up any stale notifications for staff members whose barangays are NO LONGER targeted
  await Notification.destroy({
    where: {
      reference_id: announcement.id,
      reference_type: 'announcement_staff',
      user_id: { [Op.notIn]: targetStaffUserIds.length > 0 ? targetStaffUserIds : [0] },
    },
  });

  const staffNotifications = staffUsers.map((staff) => ({
    user_id: staff.id,
    title: `📢 Activity Assigned: ${announcement.title}`,
    message: `A new announcement/activity has been scheduled for ${announcement.event_date || 'upcoming date'} at ${announcement.venue || 'designated venue'}. You are responsible for facilitating RFID attendance for targeted beneficiaries.`,
    type: 'system',
    reference_id: announcement.id,
    reference_type: 'announcement_staff',
    is_read: false,
  }));

    if (staffNotifications.length > 0) {
      await Notification.bulkCreate(staffNotifications, { ignoreDuplicates: true });
      
      // Log staff notification details for verification
      console.log(`[ANNOUNCEMENT ${announcement.id}] Notified ${staffUsers.length} staff for barangays: ${targetBarangayIds.join(', ')}`);
      staffUsers.forEach(s => {
        console.log(`  → Staff ID ${s.id}: ${s.first_name} ${s.last_name} (Barangay ID: ${s.barangay_id})`);
      });
    }

  // OPTIONAL: NOTIFY MSWDO ADMIN IF notify_mswdo IS ENABLED BY DSWD ADMIN
  let mswdoCount = 0;
  if (announcement.notify_mswdo) {
    const mswdoUsers = await User.findAll({
      where: {
        role: 'mswdo_admin',
        status: 'active',
      },
      attributes: ['id', 'first_name', 'last_name', 'email'],
    });

    const mswdoNotifications = mswdoUsers.map((mswdo) => ({
      user_id: mswdo.id,
      title: `📢 MSWDO Notice: ${announcement.title}`,
      message: `DSWD has published a new activity: "${announcement.title}" scheduled for ${announcement.event_date || 'upcoming date'} at ${announcement.venue || 'designated venue'}.`,
      type: 'system',
      reference_id: announcement.id,
      reference_type: 'announcement_mswdo',
      is_read: false,
    }));

    if (mswdoNotifications.length > 0) {
      await Notification.bulkCreate(mswdoNotifications, { ignoreDuplicates: true });
      mswdoCount = mswdoNotifications.length;
      console.log(`[ANNOUNCEMENT ${announcement.id}] Notified ${mswdoCount} MSWDO administrators.`);
    }
  } else {
    // If notify_mswdo is disabled, clean up any previous MSWDO notices
    await Notification.destroy({
      where: {
        reference_id: announcement.id,
        reference_type: 'announcement_mswdo',
      },
    });
  }

  // Audit log entry
  await AuditLog.create({
    user_id: adminUserId,
    action: `PUBLISHED_ANNOUNCEMENT: "${announcement.title}" (${matchingBeneficiaries.length} beneficiaries, ${staffUsers.length} staff notified${mswdoCount > 0 ? `, ${mswdoCount} MSWDO notified` : ''})`,
    module: 'Announcements',
    timestamp: new Date(),
  });

  return matchingBeneficiaries.length;
}

// ── GET /preview-count ── Preview matching beneficiary count (Admin/Staff/Barangay)
router.get('/preview-count', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const { target_programs, target_categories, target_barangays } = req.query;
    const catsInput = target_categories || target_programs;
    const matches = await getMatchingBeneficiaries(catsInput, target_barangays);
    res.json({ success: true, count: matches.length });
  } catch (error) {
    next(error);
  }
});

function parseDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  let hours = 23;
  let minutes = 59;

  if (timeStr) {
    const timeMatch = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      hours = h;
      minutes = m;
    }
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hours, minutes, 59);
}

async function autoCompleteExpiredAnnouncements() {
  try {
    const publishedAnnouncements = await Announcement.findAll({
      where: { status: 'published' },
    });

    const now = new Date();

    for (const ann of publishedAnnouncements) {

      const timeToCheck = ann.end_time || ann.event_time || '23:59';
      const expireTime = parseDateTime(ann.event_date, timeToCheck);

      // Only auto-complete if at least 24 hours have passed since event ended, or past expiration_date
      const gracePeriodPassed = expireTime && (now.getTime() - expireTime.getTime() > 24 * 60 * 60 * 1000);
      const isPastExpiration = ann.expiration_date && (now > parseDateTime(ann.expiration_date, '23:59'));

      if (gracePeriodPassed || isPastExpiration) {
        console.log(`⏰ Auto-completing expired announcement ID ${ann.id}: "${ann.title}"`);

        const [absentCount] = await AnnouncementRecipient.update(
          { attendance_status: 'Absent' },
          {
            where: {
              announcement_id: ann.id,
              attendance_status: 'Pending',
            },
          }
        );

        const absentRecipients = await AnnouncementRecipient.findAll({
          where: {
            announcement_id: ann.id,
            attendance_status: 'Absent',
          },
          include: [
            {
              model: Beneficiary,
              as: 'Beneficiary',
              include: [
                { model: User, attributes: ['id', 'email', 'contact_number'] },
                { model: Barangay, attributes: ['barangay_name'] },
              ],
            },
          ],
        });

        const inAppNotifications = [];
        const smsNotifications = [];

        for (const recipient of absentRecipients) {
          const b = recipient.Beneficiary;
          if (!b || !b.User) continue;

          const existingNotif = await Notification.findOne({
            where: {
              user_id: b.User.id,
              reference_id: ann.id,
              reference_type: 'announcement_absence',
            },
          });

          if (!existingNotif) {
            inAppNotifications.push({
              user_id: b.User.id,
              title: `Absent: ${ann.title}`,
              message: `You were marked absent for "${ann.title}" held on ${ann.event_date || 'N/A'}. Please contact the municipal office for more information.`,
              type: 'program',
              reference_id: ann.id,
              reference_type: 'announcement_absence',
              is_read: false,
            });
          }

          if (b.contact_number) {
            smsNotifications.push({
              beneficiary_id: b.id,
              phone_number: b.contact_number,
              message: `[EBMS] You were marked ABSENT for "${ann.title}" on ${ann.event_date || 'today'}. Please contact DSWD for details.`,
              status: 'sent',
              sent_at: new Date(),
            });
          }
        }

        if (inAppNotifications.length > 0) {
          await Notification.bulkCreate(inAppNotifications, { ignoreDuplicates: true });
        }
        if (smsNotifications.length > 0) {
          await SMSNotification.bulkCreate(smsNotifications, { ignoreDuplicates: true });
        }

        await ann.update({ status: 'completed' });

        await AuditLog.create({
          user_id: ann.created_by_user_id || 1,
          action: `AUTO_COMPLETED_ACTIVITY: "${ann.title}" - Marked ${absentCount} beneficiaries as absent`,
          module: 'Announcements',
          timestamp: new Date(),
        });
      }
    }
  } catch (err) {
    console.error('Error in autoCompleteExpiredAnnouncements:', err);
  }
}

// ── GET /my-attendance ── Beneficiary Meeting Attendance History & Summary Stats
router.get('/my-attendance', authorize('beneficiary'), async (req, res, next) => {
  try {
    await autoCompleteExpiredAnnouncements();

    const beneficiary = await Beneficiary.findOne({
      where: { user_id: req.user.id },
      include: [
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: User, attributes: ['id', 'first_name', 'last_name', 'email', 'contact_number'] },
      ],
    });

    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    // Auto-link any published or completed announcements targeting this beneficiary
    const publishedAnnouncements = await Announcement.findAll({
      where: { status: { [Op.in]: ['published', 'completed'] } },
    });

    const benCategory = (beneficiary.category || '').toLowerCase();

    for (const ann of publishedAnnouncements) {
      let targetBarangays = [];
      if (typeof ann.target_barangays === 'string') {
        try { targetBarangays = JSON.parse(ann.target_barangays); } catch (e) { targetBarangays = [ann.target_barangays]; }
      } else if (Array.isArray(ann.target_barangays)) {
        targetBarangays = ann.target_barangays;
      }
      targetBarangays = targetBarangays.map(Number).filter(Boolean);

      let targetPrograms = [];
      if (typeof ann.target_programs === 'string') {
        try { targetPrograms = JSON.parse(ann.target_programs); } catch (e) { targetPrograms = [ann.target_programs]; }
      } else if (Array.isArray(ann.target_programs)) {
        targetPrograms = ann.target_programs;
      }

      let matchesCategory = false;
      if (targetPrograms.length === 0) {
        matchesCategory = true;
      } else {
        matchesCategory = targetPrograms.some(cat => {
          const normCat = String(cat).toLowerCase();
          if (normCat.includes('4ps')) return benCategory.includes('4ps');
          if (normCat.includes('senior')) return benCategory.includes('senior');
          if (normCat.includes('pwd') || normCat.includes('disabil')) return benCategory.includes('pwd') || benCategory.includes('disabil');
          return benCategory.includes(normCat);
        });
      }

      const matchesBarangay =
        targetBarangays.length === 0 ||
        (beneficiary.barangay_id && targetBarangays.includes(Number(beneficiary.barangay_id)));

      if (matchesBarangay && matchesCategory) {
        await AnnouncementRecipient.findOrCreate({
          where: {
            announcement_id: ann.id,
            beneficiary_id: beneficiary.id,
          },
          defaults: {
            announcement_id: ann.id,
            beneficiary_id: beneficiary.id,
            user_id: req.user.id,
            is_read: false,
            attendance_status: 'Pending',
            notification_sent: true,
          },
        });
      }
    }

    // Fetch all recipient links with announcement details and staff scanner info
    const recipientLinks = await AnnouncementRecipient.findAll({
      where: { beneficiary_id: beneficiary.id },
      include: [
        {
          model: Announcement,
          include: [
            {
              model: User,
              as: 'CreatedBy',
              attributes: ['id', 'first_name', 'last_name', 'email'],
            },
          ],
        },
        {
          model: User,
          as: 'ScannedByStaff',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const records = [];
    for (const r of recipientLinks) {
      if (!r.Announcement || !['published', 'completed'].includes(r.Announcement.status)) continue;

      let targetBarangays = [];
      if (typeof r.Announcement.target_barangays === 'string') {
        try { targetBarangays = JSON.parse(r.Announcement.target_barangays); } catch (e) { targetBarangays = [r.Announcement.target_barangays]; }
      } else if (Array.isArray(r.Announcement.target_barangays)) {
        targetBarangays = r.Announcement.target_barangays;
      }
      targetBarangays = targetBarangays.map(Number).filter(Boolean);

      let targetPrograms = [];
      if (typeof r.Announcement.target_programs === 'string') {
        try { targetPrograms = JSON.parse(r.Announcement.target_programs); } catch (e) { targetPrograms = [r.Announcement.target_programs]; }
      } else if (Array.isArray(r.Announcement.target_programs)) {
        targetPrograms = r.Announcement.target_programs;
      }

      const matchesBarangay =
        targetBarangays.length === 0 ||
        (beneficiary.barangay_id && targetBarangays.includes(Number(beneficiary.barangay_id)));

      let matchesCategory = false;
      if (targetPrograms.length === 0) {
        matchesCategory = true;
      } else {
        matchesCategory = targetPrograms.some(cat => {
          const normCat = String(cat).toLowerCase();
          if (normCat.includes('4ps')) return benCategory.includes('4ps');
          if (normCat.includes('senior')) return benCategory.includes('senior');
          if (normCat.includes('pwd') || normCat.includes('disabil')) return benCategory.includes('pwd') || benCategory.includes('disabil');
          return benCategory.includes(normCat);
        });
      }

      if (matchesBarangay && matchesCategory) {
        const item = r.Announcement.toJSON();
        item.attendance_status = r.attendance_status; // 'Pending' | 'Present' | 'Absent'
        item.scanned_at = r.scanned_at;
        item.is_read = r.is_read;
        item.read_at = r.read_at;
        item.recipient_id = r.id;
        item.ScannedByStaff = r.ScannedByStaff ? {
          id: r.ScannedByStaff.id,
          first_name: r.ScannedByStaff.first_name,
          last_name: r.ScannedByStaff.last_name,
        } : null;
        records.push(item);
      }
    }

    // Compute stats
    const totalMeetings = records.length;
    const presentCount = records.filter(rec => rec.attendance_status === 'Present').length;
    const absentCount = records.filter(rec => rec.attendance_status === 'Absent').length;
    const pendingCount = records.filter(rec => rec.attendance_status === 'Pending').length;
    const concludedCount = presentCount + absentCount;
    const complianceRate = concludedCount > 0 ? Math.round((presentCount / concludedCount) * 100) : 100;

    res.json({
      success: true,
      data: {
        beneficiary: {
          id: beneficiary.id,
          first_name: beneficiary.first_name,
          last_name: beneficiary.last_name,
          RFID_number: beneficiary.RFID_number,
          beneficiary_id_code: beneficiary.beneficiary_id_code,
          category: beneficiary.category,
          status: beneficiary.status,
          barangay: beneficiary.Barangay?.barangay_name || 'N/A',
        },
        stats: {
          total_meetings: totalMeetings,
          present_count: presentCount,
          absent_count: absentCount,
          pending_count: pendingCount,
          compliance_rate: complianceRate,
        },
        records,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET / ── List announcements
router.get('/', async (req, res, next) => {
  try {
    await autoCompleteExpiredAnnouncements();
    if (req.user.role === 'beneficiary') {
      // Find beneficiary record
      let beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (!beneficiary) {
        return res.json({ success: true, data: [] });
      }

      // Sync category from active enrollment if available
      try {
        const activeEnrollment = await Enrollment.findOne({
          where: { beneficiary_id: beneficiary.id, status: 'active' },
          include: [{ model: BenefitProgram }],
          order: [['created_at', 'DESC']],
        });

        if (activeEnrollment && activeEnrollment.BenefitProgram) {
          const prog = activeEnrollment.BenefitProgram;
          const progCat = prog.eligibility_category || prog.category;
          if (progCat) {
            let stdCat = progCat;
            const lower = progCat.toLowerCase();
            if (lower.includes('4ps')) stdCat = '4Ps Household Beneficiaries';
            else if (lower.includes('senior')) stdCat = 'Senior Citizens (Social Pension)';
            else if (lower.includes('pwd') || lower.includes('disabil')) stdCat = 'Persons with Disabilities (PWD)';

            if (beneficiary.category !== stdCat) {
              await beneficiary.update({ category: stdCat });
              beneficiary.category = stdCat;
            }
          }
        }
      } catch (e) {
        console.error('Error syncing beneficiary category:', e);
      }

      // Auto-link any published or completed announcements targeting this beneficiary's barangay/category
      const publishedAnnouncements = await Announcement.findAll({
        where: { status: { [Op.in]: ['published', 'completed'] } },
      });

      for (const ann of publishedAnnouncements) {
        let targetBarangays = [];
        if (typeof ann.target_barangays === 'string') {
          try { targetBarangays = JSON.parse(ann.target_barangays); } catch (e) { targetBarangays = [ann.target_barangays]; }
        } else if (Array.isArray(ann.target_barangays)) {
          targetBarangays = ann.target_barangays;
        }
        targetBarangays = targetBarangays.map(Number).filter(Boolean);

        // Check category match
        let targetPrograms = [];
        if (typeof ann.target_programs === 'string') {
          try { targetPrograms = JSON.parse(ann.target_programs); } catch (e) { targetPrograms = [ann.target_programs]; }
        } else if (Array.isArray(ann.target_programs)) {
          targetPrograms = ann.target_programs;
        }

        let matchesCategory = false;
        if (targetPrograms.length === 0) {
          matchesCategory = true;
        } else {
          const benCategory = (beneficiary.category || '').toLowerCase();
          matchesCategory = targetPrograms.some(cat => {
            const normCat = String(cat).toLowerCase();
            if (normCat.includes('4ps')) return benCategory.includes('4ps');
            if (normCat.includes('senior')) return benCategory.includes('senior');
            if (normCat.includes('pwd') || normCat.includes('disabil')) return benCategory.includes('pwd') || benCategory.includes('disabil');
            return benCategory.includes(normCat);
          });
        }

        const matchesBarangay =
          targetBarangays.length === 0 ||
          (beneficiary.barangay_id && targetBarangays.includes(Number(beneficiary.barangay_id)));

        if (matchesBarangay && matchesCategory) {
          await AnnouncementRecipient.findOrCreate({
            where: {
              announcement_id: ann.id,
              beneficiary_id: beneficiary.id,
            },
            defaults: {
              announcement_id: ann.id,
              beneficiary_id: beneficiary.id,
              user_id: req.user.id,
              is_read: false,
              attendance_status: 'Pending',
              notification_sent: true,
            },
          });
        }
      }

      // Get recipient links for this beneficiary
      const recipientLinks = await AnnouncementRecipient.findAll({
        where: { beneficiary_id: beneficiary.id },
        include: [
          {
            model: Announcement,
            include: [
              {
                model: User,
                as: 'CreatedBy',
                attributes: ['id', 'first_name', 'last_name', 'email'],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      const benCategory = (beneficiary.category || '').toLowerCase();
      const validAnnouncements = [];
      const invalidRecipientIds = [];
      const invalidAnnouncementIds = [];

      for (const r of recipientLinks) {
        if (!r.Announcement || !['published', 'completed'].includes(r.Announcement.status)) continue;

        let targetBarangays = [];
        if (typeof r.Announcement.target_barangays === 'string') {
          try { targetBarangays = JSON.parse(r.Announcement.target_barangays); } catch (e) { targetBarangays = [r.Announcement.target_barangays]; }
        } else if (Array.isArray(r.Announcement.target_barangays)) {
          targetBarangays = r.Announcement.target_barangays;
        }
        targetBarangays = targetBarangays.map(Number).filter(Boolean);

        let targetPrograms = [];
        if (typeof r.Announcement.target_programs === 'string') {
          try { targetPrograms = JSON.parse(r.Announcement.target_programs); } catch (e) { targetPrograms = [r.Announcement.target_programs]; }
        } else if (Array.isArray(r.Announcement.target_programs)) {
          targetPrograms = r.Announcement.target_programs;
        }

        const matchesBarangay =
          targetBarangays.length === 0 ||
          (beneficiary.barangay_id && targetBarangays.includes(Number(beneficiary.barangay_id)));

        let matchesCategory = false;
        if (targetPrograms.length === 0) {
          matchesCategory = true;
        } else {
          matchesCategory = targetPrograms.some(cat => {
            const normCat = String(cat).toLowerCase();
            if (normCat.includes('4ps')) return benCategory.includes('4ps');
            if (normCat.includes('senior')) return benCategory.includes('senior');
            if (normCat.includes('pwd') || normCat.includes('disabil')) return benCategory.includes('pwd') || benCategory.includes('disabil');
            return benCategory.includes(normCat);
          });
        }

        if (matchesBarangay && matchesCategory) {
          const plain = r.Announcement.toJSON();
          plain.is_read = r.is_read;
          plain.read_at = r.read_at;
          plain.attendance_status = r.attendance_status;
          plain.scanned_at = r.scanned_at;
          plain.recipient_id = r.id;
          validAnnouncements.push(plain);
        } else {
          invalidRecipientIds.push(r.id);
          invalidAnnouncementIds.push(r.Announcement.id);
        }
      }

      // Cleanup any non-matching recipient links and in-app notifications
      if (invalidRecipientIds.length > 0) {
        await AnnouncementRecipient.destroy({ where: { id: invalidRecipientIds } });
        await Notification.destroy({
          where: {
            user_id: req.user.id,
            reference_type: 'announcement',
            reference_id: invalidAnnouncementIds,
          },
        });
      }

      return res.json({ success: true, data: validAnnouncements });
    }

    // Admin & Staff view
    const { program_id, barangay_id, priority, status, search } = req.query;
    const where = {};

    if (priority) where.priority = priority;
    if (status) where.status = status;

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { message: { [Op.like]: `%${search}%` } },
        { venue: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter MSWDO view at DB level: MSWDO only sees announcements they created OR where notify_mswdo is true
    if (isMswdoRole(req.user.role) || req.user.role === 'mswdo_admin') {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          { created_by_user_id: req.user.id },
          { notify_mswdo: true },
        ],
      });
    }

    let announcements = await Announcement.findAll({
      where,
      include: [
        {
          model: User,
          as: 'CreatedBy',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: AnnouncementRecipient,
          as: 'Recipients',
          attributes: ['id', 'attendance_status', 'is_read'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // In-memory filter for JSON target_programs and target_barangays if provided
    if (program_id) {
      const pIdNum = Number(program_id);
      announcements = announcements.filter((a) =>
        Array.isArray(a.target_programs) && a.target_programs.map(Number).includes(pIdNum)
      );
    }

    if (barangay_id) {
      const bIdNum = Number(barangay_id);
      announcements = announcements.filter((a) =>
        parseTargetBarangayIds(a.target_barangays).includes(bIdNum)
      );
    }

    // Filter staff view to events that target their barangay if role === 'barangay' OR 'staff'
    // CRITICAL: Both 'staff' and 'barangay' roles should only see announcements for their assigned barangay
    if ((req.user.role === 'barangay' || req.user.role === 'staff') && req.user.barangay_id) {
      const userBarangayId = Number(req.user.barangay_id);
      console.log(`[ANNOUNCEMENT FILTER] User: ${req.user.first_name} ${req.user.last_name} (ID: ${req.user.id})`);
      console.log(`[ANNOUNCEMENT FILTER] Role: ${req.user.role}, Barangay ID: ${userBarangayId}`);
      console.log(`[ANNOUNCEMENT FILTER] Before filter: ${announcements.length} announcements`);
      
      announcements = announcements.filter((a) => {
        const targetIds = parseTargetBarangayIds(a.target_barangays);
        const isMatch = targetIds.includes(userBarangayId);
        if (!isMatch) {
          console.log(`[ANNOUNCEMENT FILTER]   ❌ Filtered out: "${a.title}" (Target barangays: ${JSON.stringify(targetIds)})`);
        } else {
          console.log(`[ANNOUNCEMENT FILTER]   ✅ Included: "${a.title}" (Target barangays: ${JSON.stringify(targetIds)})`);
        }
        return isMatch;
      });
      
      console.log(`[ANNOUNCEMENT FILTER] After filter: ${announcements.length} announcements\n`);
    }

    // Filter MSWDO view: If DSWD Admin did NOT notify MSWDO (notify_mswdo is false),
    // then the announcement is direct-only for Barangay Staff & Beneficiary, and MUST NOT appear to MSWDO!
    if (isMswdoRole(req.user.role) || req.user.role === 'mswdo_admin') {
      announcements = announcements.filter((a) => {
        const isAuthor = a.created_by_user_id === req.user.id || a.CreatedBy?.id === req.user.id;
        const isNotified = Boolean(a.notify_mswdo);
        return isAuthor || isNotified;
      });
    }

    // Attach present_count summary
    const formatted = announcements.map((a) => {
      const plain = a.toJSON();
      const recipients = plain.Recipients || [];
      plain.present_count = recipients.filter((r) => r.attendance_status === 'Present').length;
      plain.absent_count = plain.recipient_count - plain.present_count;
      return plain;
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id ── Get single announcement details & attendance summary
router.get('/:id', async (req, res, next) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'CreatedBy',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
        {
          model: AnnouncementRecipient,
          as: 'Recipients',
          include: [
            {
              model: Beneficiary,
              as: 'Beneficiary',
              attributes: ['id', 'first_name', 'last_name', 'contact_number', 'RFID_number', 'beneficiary_id_code', 'profile_photo', 'category'],
              include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
            },
            {
              model: User,
              as: 'ScannedByStaff',
              attributes: ['id', 'first_name', 'last_name'],
            },
          ],
        },
      ],
    });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    // Security check: If MSWDO, cannot view direct-only announcements where MSWDO was not notified
    if (isMswdoRole(req.user.role) || req.user.role === 'mswdo_admin') {
      const isAuthor = announcement.created_by_user_id === req.user.id || announcement.CreatedBy?.id === req.user.id;
      const isNotified = Boolean(announcement.notify_mswdo);
      if (!isAuthor && !isNotified) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: MSWDO was not notified for this announcement.',
        });
      }
    }

    const plain = announcement.toJSON();
    const recipients = plain.Recipients || [];
    plain.present_count = recipients.filter((r) => r.attendance_status === 'Present').length;
    plain.absent_count = plain.recipient_count - plain.present_count;
    plain.attendance_percentage = plain.recipient_count > 0 ? Math.round((plain.present_count / plain.recipient_count) * 100) : 0;

    res.json({ success: true, data: plain });
  } catch (error) {
    next(error);
  }
});

// ── POST / ── Create announcement (Admin/Staff/Barangay)
router.post('/', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const {
      title,
      message,
      event_date,
      event_time,
      end_time,
      venue,
      priority = 'Medium',
      status = 'published',
      expiration_date,
      target_programs = [],
      target_barangays = [],
      notify_mswdo = false,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and description message are required' });
    }

    const targetCatsOrProgs = req.body.target_categories || target_programs;
    if (!Array.isArray(targetCatsOrProgs) || targetCatsOrProgs.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one target category must be selected' });
    }

    if (req.user.role === 'mswdo_admin') {
      const has4Ps = targetCatsOrProgs.some(cat => String(cat).toLowerCase().includes('4ps'));
      if (has4Ps) {
        return res.status(403).json({ success: false, message: 'Access denied: MSWDO Admin cannot create announcements for 4Ps programs' });
      }
    }

    const parsedBarangays = parseTargetBarangayIds(target_barangays);
    if (parsedBarangays.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one target barangay must be selected' });
    }

    const announcement = await Announcement.create({
      title,
      message,
      event_date: event_date || null,
      event_time: event_time || null,
      end_time: end_time || null,
      venue: venue || null,
      priority,
      status,
      publish_date: status === 'published' ? new Date() : null,
      expiration_date: expiration_date || null,
      target_programs: targetCatsOrProgs,
      target_barangays: parsedBarangays,
      notify_mswdo: (req.user.role === 'admin' && notify_mswdo !== undefined) ? !!notify_mswdo : false,
      created_by_user_id: req.user.id,
      recipient_count: 0,
      view_count: 0,
    });

    if (status === 'published') {
      await dispatchAnnouncementNotifications(announcement, req.user.id);
    } else {
      await AuditLog.create({
        user_id: req.user.id,
        action: `CREATED_ANNOUNCEMENT_DRAFT: "${announcement.title}"`,
        module: 'Announcements',
        timestamp: new Date(),
      });
    }

    const fullAnnouncement = await Announcement.findByPk(announcement.id, {
      include: [
        {
          model: User,
          as: 'CreatedBy',
          attributes: ['id', 'first_name', 'last_name', 'email'],
        },
      ],
    });

    res.status(201).json({ success: true, data: fullAnnouncement });
  } catch (error) {
    next(error);
  }
});

// ── POST /:id/scan-rfid ── Barangay Staff RFID Attendance Scan
router.post('/:id/scan-rfid', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const { RFID_number } = req.body;
    if (!RFID_number) {
      return res.status(400).json({ success: false, message: 'RFID number is required' });
    }

    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement activity not found' });
    }

    // Find beneficiary by RFID or Beneficiary ID code
    const beneficiary = await Beneficiary.findOne({
      where: {
        [Op.or]: [
          { RFID_number: RFID_number.trim() },
          { beneficiary_id_code: RFID_number.trim() },
        ],
      },
      include: [
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: User, attributes: ['id', 'email', 'contact_number'] },
      ],
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: `RFID card / ID "${RFID_number}" is not registered in the system.`,
      });
    }

    // Verify if beneficiary is on the announcement recipient list
    const recipient = await AnnouncementRecipient.findOne({
      where: {
        announcement_id: announcement.id,
        beneficiary_id: beneficiary.id,
      },
    });

    if (!recipient) {
      return res.status(400).json({
        success: false,
        message: `REJECTED: Beneficiary ${beneficiary.first_name} ${beneficiary.last_name} (${beneficiary.Barangay?.barangay_name || 'N/A'}) is not included in this selected announcement activity.`,
        beneficiary: {
          id: beneficiary.id,
          first_name: beneficiary.first_name,
          last_name: beneficiary.last_name,
          barangay_name: beneficiary.Barangay?.barangay_name,
        },
      });
    }

    // Check if already marked present (Prevent duplicate scan)
    if (recipient.attendance_status === 'Present') {
      return res.status(409).json({
        success: false,
        message: `DUPLICATE SCAN: Beneficiary ${beneficiary.first_name} ${beneficiary.last_name} has ALREADY been recorded present at ${recipient.scanned_at ? new Date(recipient.scanned_at).toLocaleTimeString() : 'earlier'}.`,
        beneficiary: {
          id: beneficiary.id,
          first_name: beneficiary.first_name,
          last_name: beneficiary.last_name,
          beneficiary_id_code: beneficiary.beneficiary_id_code,
          scanned_at: recipient.scanned_at,
        },
      });
    }

    // Record attendance
    const now = new Date();
    await recipient.update({
      attendance_status: 'Present',
      scanned_at: now,
      scanned_by_staff_id: req.user.id,
    });

    // Create log in Attendance table
    await Attendance.create({
      beneficiary_id: beneficiary.id,
      RFID_number: beneficiary.RFID_number || RFID_number,
      event_name: announcement.title,
      announcement_id: announcement.id,
      scanned_by_staff_id: req.user.id,
      attendance_date: now.toISOString().split('T')[0],
      time_in: now.toTimeString().split(' ')[0],
      status: 'Present',
      remarks: `Scanned by Staff ID ${req.user.id} (${req.user.first_name} ${req.user.last_name})`,
    });

    // Log to Audit Trail
    await AuditLog.create({
      user_id: req.user.id,
      action: `RFID_ATTENDANCE_PRESENT: Scanned ${beneficiary.first_name} ${beneficiary.last_name} (${beneficiary.beneficiary_id_code}) for "${announcement.title}"`,
      module: 'Attendance',
      timestamp: now,
    });

    // Fetch updated attendance stats
    const totalRecipients = await AnnouncementRecipient.count({ where: { announcement_id: announcement.id } });
    const presentCount = await AnnouncementRecipient.count({ where: { announcement_id: announcement.id, attendance_status: 'Present' } });

    res.json({
      success: true,
      message: `SUCCESS: Attendance recorded for ${beneficiary.first_name} ${beneficiary.last_name}!`,
      beneficiary: {
        id: beneficiary.id,
        first_name: beneficiary.first_name,
        last_name: beneficiary.last_name,
        beneficiary_id_code: beneficiary.beneficiary_id_code,
        profile_photo: beneficiary.profile_photo,
        category: beneficiary.category,
        barangay_name: beneficiary.Barangay?.barangay_name,
        scanned_at: now,
      },
      stats: {
        total_expected: totalRecipients,
        total_present: presentCount,
        total_absent: totalRecipients - presentCount,
        percentage: totalRecipients > 0 ? Math.round((presentCount / totalRecipients) * 100) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id/attendance-stats ── Real-time Stats & Attendee/Absentee List
router.get('/:id/attendance-stats', async (req, res, next) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const recipients = await AnnouncementRecipient.findAll({
      where: { announcement_id: announcement.id },
      include: [
        {
          model: Beneficiary,
          as: 'Beneficiary',
          attributes: ['id', 'first_name', 'last_name', 'contact_number', 'RFID_number', 'beneficiary_id_code', 'category', 'profile_photo'],
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
        },
        {
          model: User,
          as: 'ScannedByStaff',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
      order: [['scanned_at', 'DESC']],
    });

    const presentList = recipients.filter((r) => r.attendance_status === 'Present');
    const absentList = recipients.filter((r) => r.attendance_status !== 'Present');

    const totalExpected = recipients.length;
    const totalPresent = presentList.length;
    const totalAbsent = absentList.length;
    const percentage = totalExpected > 0 ? Math.round((totalPresent / totalExpected) * 100) : 0;

    res.json({
      success: true,
      data: {
        announcement_id: announcement.id,
        title: announcement.title,
        event_date: announcement.event_date,
        venue: announcement.venue,
        stats: {
          total_expected: totalExpected,
          total_present: totalPresent,
          total_absent: totalAbsent,
          percentage,
        },
        present_attendees: presentList,
        absentees: absentList,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /:id/complete ── Auto-complete activity and notify absent beneficiaries
router.post('/:id/complete', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    // Update all pending recipients to absent
    const absentCount = await AnnouncementRecipient.update(
      { attendance_status: 'Absent' },
      { 
        where: { 
          announcement_id: announcement.id,
          attendance_status: 'Pending'
        } 
      }
    );

    // Get all absent beneficiaries
    const absentRecipients = await AnnouncementRecipient.findAll({
      where: { 
        announcement_id: announcement.id,
        attendance_status: 'Absent'
      },
      include: [
        {
          model: Beneficiary,
          as: 'Beneficiary',
          include: [
            { model: User, attributes: ['id', 'email', 'contact_number'] },
            { model: Barangay, attributes: ['barangay_name'] }
          ],
        },
      ],
    });

    // Send notifications to absent beneficiaries
    const inAppNotifications = [];
    const smsNotifications = [];

    for (const recipient of absentRecipients) {
      const b = recipient.Beneficiary;
      if (!b || !b.User) continue;

      // In-app notification
      inAppNotifications.push({
        user_id: b.User.id,
        title: `Absent: ${announcement.title}`,
        message: `You were marked absent for "${announcement.title}" held on ${announcement.event_date || 'N/A'}. Please contact the municipal office for more information.`,
        type: 'program',
        reference_id: announcement.id,
        reference_type: 'announcement_absence',
        is_read: false,
      });

      // SMS notification (if contact number available)
      if (b.contact_number) {
        smsNotifications.push({
          beneficiary_id: b.id,
          phone_number: b.contact_number,
          message: `[EBMS] You were marked ABSENT for "${announcement.title}" on ${announcement.event_date || 'today'}. Please contact DSWD for details.`,
          status: 'sent',
          sent_at: new Date(),
        });
      }
    }

    // Bulk insert notifications
    if (inAppNotifications.length > 0) {
      await Notification.bulkCreate(inAppNotifications);
    }
    if (smsNotifications.length > 0) {
      await SMSNotification.bulkCreate(smsNotifications);
    }

    // Update announcement status to completed
    await announcement.update({ status: 'completed' });

    // Log to audit trail
    await AuditLog.create({
      user_id: req.user.id,
      action: `COMPLETED_ACTIVITY: "${announcement.title}" - Marked ${absentCount[0]} beneficiaries as absent and sent ${inAppNotifications.length} notifications`,
      module: 'Announcements',
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: `Activity completed successfully. ${absentCount[0]} beneficiaries marked as absent and notified.`,
      data: {
        total_absent: absentRecipients.length,
        notifications_sent: inAppNotifications.length,
        sms_sent: smsNotifications.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id/export ── Export Full Attendance Report (JSON/CSV Dataset for PDF/Excel)
router.get('/:id/export', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id, {
      include: [{ model: User, as: 'CreatedBy', attributes: ['id', 'first_name', 'last_name'] }],
    });
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const recipients = await AnnouncementRecipient.findAll({
      where: { announcement_id: announcement.id },
      include: [
        {
          model: Beneficiary,
          as: 'Beneficiary',
          include: [{ model: Barangay, attributes: ['barangay_name'] }],
        },
        {
          model: User,
          as: 'ScannedByStaff',
          attributes: ['first_name', 'last_name'],
        },
      ],
      order: [['attendance_status', 'ASC'], ['scanned_at', 'ASC']],
    });

    await AuditLog.create({
      user_id: req.user.id,
      action: `GENERATED_ATTENDANCE_REPORT: "${announcement.title}"`,
      module: 'Reports',
      timestamp: new Date(),
    });

    const reportRows = recipients.map((r, index) => ({
      row_number: index + 1,
      beneficiary_id_code: r.Beneficiary?.beneficiary_id_code || 'N/A',
      beneficiary_name: `${r.Beneficiary?.first_name || ''} ${r.Beneficiary?.last_name || ''}`,
      barangay: r.Beneficiary?.Barangay?.barangay_name || 'N/A',
      rfid_number: r.Beneficiary?.RFID_number || 'N/A',
      contact_number: r.Beneficiary?.contact_number || 'N/A',
      attendance_status: r.attendance_status,
      scanned_at: r.scanned_at ? new Date(r.scanned_at).toLocaleString() : '—',
      facilitated_by: r.ScannedByStaff ? `${r.ScannedByStaff.first_name} ${r.ScannedByStaff.last_name}` : '—',
    }));

    res.json({
      success: true,
      event: {
        id: announcement.id,
        title: announcement.title,
        event_date: announcement.event_date,
        event_time: announcement.event_time,
        venue: announcement.venue,
        created_by: `${announcement.CreatedBy?.first_name || ''} ${announcement.CreatedBy?.last_name || ''}`,
      },
      summary: {
        total_recipients: recipients.length,
        total_present: recipients.filter((r) => r.attendance_status === 'Present').length,
        total_absent: recipients.filter((r) => r.attendance_status !== 'Present').length,
      },
      report: reportRows,
    });
  } catch (error) {
    next(error);
  }
});

// ── PUT /:id ── Edit/Update announcement (Admin/Staff/Barangay)
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const {
      title,
      message,
      event_date,
      event_time,
      end_time,
      venue,
      priority,
      status,
      expiration_date,
      target_programs,
      target_categories,
      target_barangays,
      notify_mswdo,
    } = req.body;

    const previousStatus = announcement.status;
    const targetCatsOrProgs = target_categories || target_programs || announcement.target_programs;

    if (req.user.role === 'mswdo_admin') {
      const existingHas4Ps = Array.isArray(announcement.target_programs) && announcement.target_programs.some(cat => String(cat).toLowerCase().includes('4ps'));
      const newHas4Ps = Array.isArray(targetCatsOrProgs) && targetCatsOrProgs.some(cat => String(cat).toLowerCase().includes('4ps'));
      if (existingHas4Ps || newHas4Ps) {
        return res.status(403).json({ success: false, message: 'Access denied: MSWDO Admin cannot modify 4Ps announcements' });
      }
    }

    const updatedBarangays = target_barangays !== undefined 
      ? parseTargetBarangayIds(target_barangays) 
      : parseTargetBarangayIds(announcement.target_barangays);

    await announcement.update({
      title: title ?? announcement.title,
      message: message ?? announcement.message,
      event_date: event_date !== undefined ? event_date : announcement.event_date,
      event_time: event_time !== undefined ? event_time : announcement.event_time,
      end_time: end_time !== undefined ? end_time : announcement.end_time,
      venue: venue !== undefined ? venue : announcement.venue,
      priority: priority ?? announcement.priority,
      status: status ?? announcement.status,
      expiration_date: expiration_date !== undefined ? expiration_date : announcement.expiration_date,
      target_programs: targetCatsOrProgs,
      target_barangays: updatedBarangays,
      notify_mswdo: (req.user.role === 'admin' && notify_mswdo !== undefined) ? !!notify_mswdo : announcement.notify_mswdo,
    });

    if (announcement.status === 'published') {
      if (previousStatus !== 'published') {
        await announcement.update({ publish_date: new Date() });
      }
      await dispatchAnnouncementNotifications(announcement, req.user.id);
    } else {
      await AuditLog.create({
        user_id: req.user.id,
        action: `UPDATED_ANNOUNCEMENT: "${announcement.title}"`,
        module: 'Announcements',
        timestamp: new Date(),
      });
    }

    const updated = await Announcement.findByPk(announcement.id, {
      include: [{ model: User, as: 'CreatedBy', attributes: ['id', 'first_name', 'last_name'] }],
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /:id/resend ── Resend announcement notifications (Admin only)
router.patch('/:id/resend', authorize('admin'), async (req, res, next) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const recipientCount = await dispatchAnnouncementNotifications(announcement, req.user.id);

    res.json({
      success: true,
      message: `Announcement notifications resent successfully to ${recipientCount} beneficiaries and assigned Barangay Staff`,
      recipient_count: recipientCount,
    });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /:id/read ── Mark announcement as read (Beneficiary)
router.patch('/:id/read', async (req, res, next) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    const recipient = await AnnouncementRecipient.findOne({
      where: {
        announcement_id: announcement.id,
        beneficiary_id: beneficiary.id,
      },
    });

    if (recipient) {
      if (!recipient.is_read) {
        await recipient.update({ is_read: true, read_at: new Date() });
        await announcement.increment('view_count');

        await Notification.update(
          { is_read: true },
          {
            where: {
              user_id: req.user.id,
              reference_id: announcement.id,
              reference_type: { [Op.in]: ['announcement', 'announcement_absence', 'announcement_staff', 'announcement_mswdo'] },
            },
          }
        );

        await AuditLog.create({
          user_id: req.user.id,
          action: `VIEWED_ANNOUNCEMENT: "${announcement.title}"`,
          module: 'Announcements',
          timestamp: new Date(),
        });
      }
    }

    res.json({ success: true, message: 'Announcement marked as read' });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /:id ── Delete announcement (Admin only)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const announcement = await Announcement.findByPk(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const title = announcement.title;

    // Clean up all related notifications & recipients
    await Notification.destroy({
      where: {
        reference_id: req.params.id,
        reference_type: { [Op.in]: ['announcement', 'announcement_staff', 'announcement_mswdo', 'announcement_absence'] },
      },
    });
    await AnnouncementRecipient.destroy({
      where: { announcement_id: req.params.id },
    });

    await announcement.destroy();

    await AuditLog.create({
      user_id: req.user.id,
      action: `DELETED_ANNOUNCEMENT: "${title}"`,
      module: 'Announcements',
      timestamp: new Date(),
    });

    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
