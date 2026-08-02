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

const router = express.Router();
router.use(authenticate);

// Helper function to find target matching beneficiaries
async function getMatchingBeneficiaries(programIds, barangayIds) {
  const pIds = (Array.isArray(programIds) ? programIds : [programIds]).map(Number).filter(Boolean);
  const bIds = (Array.isArray(barangayIds) ? barangayIds : [barangayIds]).map(Number).filter(Boolean);

  if (pIds.length === 0 || bIds.length === 0) {
    return [];
  }

  // Active enrollments for selected programs
  const activeEnrollments = await Enrollment.findAll({
    where: {
      program_id: pIds,
      status: 'active',
    },
    attributes: ['beneficiary_id'],
    raw: true,
  });

  const enrolledBeneficiaryIds = [...new Set(activeEnrollments.map((e) => e.beneficiary_id))];
  if (enrolledBeneficiaryIds.length === 0) {
    return [];
  }

  // Filter beneficiaries by registered barangay
  const matchingBeneficiaries = await Beneficiary.findAll({
    where: {
      id: enrolledBeneficiaryIds,
      barangay_id: bIds,
    },
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

      inAppNotifications.push({
        user_id: b.user_id,
        title: announcement.title,
        message: announcement.message,
        type: 'program',
        reference_id: announcement.id,
        reference_type: 'announcement',
        is_read: false,
      });

      if (b.contact_number) {
        smsNotifications.push({
          beneficiary_id: b.id,
          phone_number: b.contact_number,
          message: `[EBMS ANNOUNCEMENT] ${announcement.title}: ${announcement.message.substring(0, 120)}... Date: ${announcement.event_date || 'N/A'} ${announcement.event_time || ''}`,
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

  // NOTIFY ASSIGNED BARANGAY STAFF
  const targetBarangayIds = (Array.isArray(announcement.target_barangays) ? announcement.target_barangays : [announcement.target_barangays]).map(Number).filter(Boolean);
  const staffUsers = await User.findAll({
    where: {
      role: { [Op.in]: ['staff', 'barangay'] },
      status: 'active',
      [Op.or]: [
        { barangay_id: { [Op.in]: targetBarangayIds } },
        { barangay_id: null }, // system staff
      ],
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
  }

  // Audit log entry
  await AuditLog.create({
    user_id: adminUserId,
    action: `PUBLISHED_ANNOUNCEMENT: "${announcement.title}" (${matchingBeneficiaries.length} beneficiaries, ${staffUsers.length} staff notified)`,
    module: 'Announcements',
    timestamp: new Date(),
  });

  return matchingBeneficiaries.length;
}

// ── GET /preview-count ── Preview matching beneficiary count (Admin only)
router.get('/preview-count', authorize('admin'), async (req, res, next) => {
  try {
    const { target_programs, target_barangays } = req.query;
    const pIds = target_programs ? JSON.parse(target_programs) : [];
    const bIds = target_barangays ? JSON.parse(target_barangays) : [];

    const matches = await getMatchingBeneficiaries(pIds, bIds);
    res.json({ success: true, count: matches.length });
  } catch (error) {
    next(error);
  }
});

// ── GET / ── List announcements
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'beneficiary') {
      // Find beneficiary record
      const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (!beneficiary) {
        return res.json({ success: true, data: [] });
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

      const announcements = recipientLinks
        .filter((r) => r.Announcement && r.Announcement.status === 'published')
        .map((r) => {
          const plain = r.Announcement.toJSON();
          plain.is_read = r.is_read;
          plain.read_at = r.read_at;
          plain.attendance_status = r.attendance_status;
          plain.scanned_at = r.scanned_at;
          plain.recipient_id = r.id;
          return plain;
        });

      return res.json({ success: true, data: announcements });
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
        Array.isArray(a.target_barangays) && a.target_barangays.map(Number).includes(bIdNum)
      );
    }

    // Filter staff view to events that target their barangay if role === 'barangay'
    if (req.user.role === 'barangay' && req.user.barangay_id) {
      announcements = announcements.filter((a) =>
        Array.isArray(a.target_barangays) && a.target_barangays.map(Number).includes(req.user.barangay_id)
      );
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

// ── POST / ── Create announcement (Admin only)
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const {
      title,
      message,
      event_date,
      event_time,
      venue,
      priority = 'Medium',
      status = 'published',
      expiration_date,
      target_programs = [],
      target_barangays = [],
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and description message are required' });
    }

    if (!Array.isArray(target_programs) || target_programs.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one target program must be selected' });
    }

    if (!Array.isArray(target_barangays) || target_barangays.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one target barangay must be selected' });
    }

    const announcement = await Announcement.create({
      title,
      message,
      event_date: event_date || null,
      event_time: event_time || null,
      venue: venue || null,
      priority,
      status,
      publish_date: status === 'published' ? new Date() : null,
      expiration_date: expiration_date || null,
      target_programs,
      target_barangays,
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

// ── PUT /:id ── Edit/Update announcement (Admin only)
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
      venue,
      priority,
      status,
      expiration_date,
      target_programs,
      target_barangays,
    } = req.body;

    const previousStatus = announcement.status;

    await announcement.update({
      title: title ?? announcement.title,
      message: message ?? announcement.message,
      event_date: event_date !== undefined ? event_date : announcement.event_date,
      event_time: event_time !== undefined ? event_time : announcement.event_time,
      venue: venue !== undefined ? venue : announcement.venue,
      priority: priority ?? announcement.priority,
      status: status ?? announcement.status,
      expiration_date: expiration_date !== undefined ? expiration_date : announcement.expiration_date,
      target_programs: target_programs ?? announcement.target_programs,
      target_barangays: target_barangays ?? announcement.target_barangays,
    });

    if (status === 'published' && previousStatus !== 'published') {
      await announcement.update({ publish_date: new Date() });
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
              reference_type: 'announcement',
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
