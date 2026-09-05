require('dotenv').config();
const {
  Announcement,
  AnnouncementRecipient,
  Beneficiary,
  Notification,
  SMSNotification,
  AuditLog,
  User,
  Barangay,
  sequelize,
} = require('./db');
const { Op } = require('sequelize');

// Helper to safely parse target barangays
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

// Find matching beneficiaries by categories & barangays
async function getMatchingBeneficiaries(targetCategories, barangayIdsInput) {
  let categories = Array.isArray(targetCategories) ? targetCategories : [targetCategories];
  let bIds = parseTargetBarangayIds(barangayIdsInput);

  if (bIds.length === 0) return [];

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

  const whereClause = {
    status: 'Approved',
    barangay_id: { [Op.in]: bIds },
  };

  if (categoryConditions.length > 0) {
    whereClause[Op.or] = categoryConditions;
  }

  return await Beneficiary.findAll({
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
}

// Dispatch notifications helper
async function dispatchAnnouncementNotifications(announcement, adminUserId) {
  const matchingBeneficiaries = await getMatchingBeneficiaries(
    announcement.target_programs,
    announcement.target_barangays
  );

  if (matchingBeneficiaries.length === 0) {
    await announcement.update({ recipient_count: 0 });
    return 0;
  }

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

    if (b.user_id) {
      inAppNotifications.push({
        user_id: b.user_id,
        title: announcement.title,
        message: `${announcement.message}${schedText ? `\n\n📅 ${schedText}` : ''}${announcement.venue ? `\n📍 Venue: ${announcement.venue}` : ''}`,
        type: 'announcement',
        reference_id: announcement.id,
        reference_type: 'announcement',
        is_read: false,
      });
    }

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
    await SMSNotification.bulkCreate(smsNotifications);
  }

  await announcement.update({ recipient_count: matchingBeneficiaries.length });

  await AuditLog.create({
    user_id: adminUserId,
    action: `PUBLISHED_ANNOUNCEMENT: "${announcement.title}" (${matchingBeneficiaries.length} beneficiaries notified)`,
    module: 'Announcements',
    timestamp: new Date(),
  });

  return matchingBeneficiaries.length;
}

// ── 9 OFFICIAL MEETINGS FOR DSWD ANNOUNCEMENT ──
const MEETINGS_DATA = [
  // ── 4Ps (DSWD) MEETINGS ──
  {
    program: '4Ps',
    title: '4Ps: Family Development Session (FDS)',
    message: 'Family Development Session (FDS) para sa lahat ng 4Ps household beneficiaries. Tatalakayin ang responsableng pagiging magulang, kalusugan, nutrisyon, at edukasyon ng mga bata. Mangyaring dalhin ang inyong RFID Beneficiary Card para sa attendance verification.',
    event_date: '2026-09-08',
    event_time: '08:00',
    end_time: '11:30',
    venue: 'Barangay Covered Court',
    priority: 'High',
    status: 'published',
    target_categories: ['4Ps Household Beneficiaries'],
    created_by_user_id: 1, // DSWD Admin
  },
  {
    program: '4Ps',
    title: '4Ps: Program Orientation',
    message: 'Oryentasyon ukol sa mga patakaran, karapatan, at responsibilidad ng mga benepisyaryo ng Pantawid Pamilyang Pilipino Program (4Ps). Pagsusuri ng compliance rules, RFID card verification, at gabay sa paggamit ng mga serbisyong pampamahalaan.',
    event_date: '2026-09-11',
    event_time: '08:30',
    end_time: '12:00',
    venue: 'Bongabong Municipal Gymnasium',
    priority: 'Medium',
    status: 'published',
    target_categories: ['4Ps Household Beneficiaries'],
    created_by_user_id: 1, // DSWD Admin
  },
  {
    program: '4Ps',
    title: '4Ps: Financial Literacy Session',
    message: 'Pagsasanay sa wastong paghawak ng pera, pagbabadyet ng sambahayan, pag-iimpok (savings), at mga oportunidad sa micro-livelihood sa ilalim ng Sustainable Livelihood Program (SLP) module.',
    event_date: '2026-09-15',
    event_time: '09:00',
    end_time: '12:00',
    venue: 'Barangay Multi-Purpose Hall',
    priority: 'Medium',
    status: 'published',
    target_categories: ['4Ps Household Beneficiaries'],
    created_by_user_id: 1, // DSWD Admin
  },

  // ── SENIOR CITIZENS (OSCA / MSWDO) MEETINGS ──
  {
    program: 'Senior',
    title: 'Senior Citizens: Social Pension Orientation',
    message: 'Oryentasyon at balidasyon para sa mga benepisyaryo ng Social Pension for Indigent Senior Citizens. Tatalakayin ang mga patakaran sa pagtanggap ng stipend, verification ng senior documents, at nakatakdang payout schedule.',
    event_date: '2026-09-18',
    event_time: '09:00',
    end_time: '12:00',
    venue: 'OSCA Office / Municipal Session Hall',
    priority: 'Medium',
    status: 'published',
    target_categories: ['Senior Citizens (Social Pension)'],
    created_by_user_id: 1,
  },
  {
    program: 'Senior',
    title: 'Senior Citizens: Senior Citizen Assembly',
    message: 'Pangkalahatang pagpupulong at asembleya ng mga Senior Citizens kasama ang OSCA at MSWDO para sa updates sa mga bagong benepisyo, lokal na ordinansa, at kapakanan ng mga nakatatanda sa komunidad.',
    event_date: '2026-09-22',
    event_time: '08:30',
    end_time: '12:00',
    venue: 'Bongabong Municipal Gymnasium',
    priority: 'Medium',
    status: 'published',
    target_categories: ['Senior Citizens (Social Pension)'],
    created_by_user_id: 1,
  },
  {
    program: 'Senior',
    title: 'Senior Citizens: Health/Wellness Session',
    message: 'Libreng konsultasyong medikal, geriatric wellness checkup, pamamahagi ng maintenance medicines para sa altapresyon at diabetes, pamimigay ng bitamina, at blood pressure monitoring para sa mga Senior Citizens.',
    event_date: '2026-09-24',
    event_time: '08:00',
    end_time: '14:00',
    venue: 'Rural Health Unit / Barangay Health Center',
    priority: 'High',
    status: 'published',
    target_categories: ['Senior Citizens (Social Pension)'],
    created_by_user_id: 1,
  },

  // ── PERSONS WITH DISABILITIES (PDAO / MSWDO) MEETINGS ──
  {
    program: 'PWD',
    title: 'PWD: PWD Orientation',
    message: 'Komprehensibong oryentasyon ukol sa mga karapatan at pribilehiyo ng mga Persons with Disabilities (PWD) alinsunod sa RA 7277 at RA 10754 (20% discount sa bilihin, gamot, pamasahe, at VAT exemption), PhilHealth benefits, at mga proteksyon sa batas.',
    event_date: '2026-09-26',
    event_time: '09:00',
    end_time: '12:00',
    venue: 'PDAO Center / Municipal Multi-Purpose Hall',
    priority: 'Medium',
    status: 'published',
    target_categories: ['Persons with Disabilities (PWD)'],
    created_by_user_id: 1,
  },
  {
    program: 'PWD',
    title: 'PWD: PWD Assembly/Consultation',
    message: 'Pangkalahatang konsultasyon at asembleya ng PDAO kasama ang MSWDO upang dinggin ang mga pangangailangan ng PWD community, accessibility concerns, assistive device applications, at suportang medikal.',
    event_date: '2026-09-28',
    event_time: '09:00',
    end_time: '13:00',
    venue: 'Bongabong Municipal Gymnasium / Covered Court',
    priority: 'Medium',
    status: 'published',
    target_categories: ['Persons with Disabilities (PWD)'],
    created_by_user_id: 1,
  },
  {
    program: 'PWD',
    title: 'PWD: Skills/Capability Training',
    message: 'Pagsasanay sa kasanayan at pangkabuhayan (skills & capability development) na angkop sa kakayahan ng mga Persons with Disabilities upang magkaroon ng sariling hanapbuhay at produktibong kabuhayan.',
    event_date: '2026-09-30',
    event_time: '08:30',
    end_time: '15:00',
    venue: 'Bongabong Skills Training Center / Multi-Purpose Hall',
    priority: 'Medium',
    status: 'published',
    target_categories: ['Persons with Disabilities (PWD)'],
    created_by_user_id: 1,
  },
];

async function seedMeetings() {
  console.log('🚀 Starting official meeting announcements creation for DSWD Admin...');

  // Clear existing announcements & recipients to keep system completely aligned
  console.log('🧹 Clearing previous meeting announcements...');
  await AnnouncementRecipient.destroy({ where: {} });
  await Announcement.destroy({ where: {} });

  const barangays = await Barangay.findAll({ attributes: ['id'] });
  const allBarangayIds = barangays.map(b => b.id);
  console.log(`📌 Found ${allBarangayIds.length} barangays:`, allBarangayIds);

  let createdCount = 0;
  for (const item of MEETINGS_DATA) {
    const ann = await Announcement.create({
      title: item.title,
      message: item.message,
      event_date: item.event_date,
      event_time: item.event_time,
      end_time: item.end_time,
      venue: item.venue,
      priority: item.priority,
      status: item.status,
      publish_date: new Date(),
      target_programs: item.target_categories,
      target_barangays: allBarangayIds,
      created_by_user_id: item.created_by_user_id,
      recipient_count: 0,
      view_count: 0,
    });

    const notifiedCount = await dispatchAnnouncementNotifications(ann, item.created_by_user_id);
    console.log(`✅ Created [${ann.id}]: "${ann.title}" (${item.program}) - Notified ${notifiedCount} beneficiaries.`);
    createdCount++;
  }

  console.log(`\n🎉 Done! Successfully created ${createdCount} official meeting announcements.`);
  process.exit(0);
}

seedMeetings().catch((err) => {
  console.error('❌ Error creating meetings:', err);
  process.exit(1);
});
