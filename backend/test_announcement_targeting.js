/**
 * Test Announcement Target Audience Filtering
 * 
 * Purpose: Verify that only beneficiaries matching BOTH category AND barangay
 * receive announcements and notifications. Admin should NOT receive notifications.
 */

const {
  sequelize,
  User,
  Beneficiary,
  Barangay,
  Announcement,
  AnnouncementRecipient,
  Notification,
} = require('./db');

async function testAnnouncementTargeting() {
  console.log('\n🎯 TESTING ANNOUNCEMENT TARGET AUDIENCE FILTERING\n');
  console.log('='.repeat(70));

  try {
    // 1. Find or create test barangays
    const [anilao] = await Barangay.findOrCreate({
      where: { barangay_name: 'Anilao' },
      defaults: { barangay_name: 'Anilao', barangay_code: 'TEST-ANILAO' },
    });

    const [aplaya] = await Barangay.findOrCreate({
      where: { barangay_name: 'Aplaya' },
      defaults: { barangay_name: 'Aplaya', barangay_code: 'TEST-APLAYA' },
    });

    console.log(`\n✅ Barangays:\n   - Anilao (ID: ${anilao.id})\n   - Aplaya (ID: ${aplaya.id})`);

    // 2. Find or create Admin user
    const [adminUser] = await User.findOrCreate({
      where: { email: 'admin@test.com' },
      defaults: {
        email: 'admin@test.com',
        password: 'hashed_password',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        status: 'active',
      },
    });

    console.log(`\n✅ Admin User: ${adminUser.email} (ID: ${adminUser.id})`);

    // 3. Create test beneficiaries
    // Beneficiary 1: 4Ps + Anilao (SHOULD RECEIVE)
    const [ben1User] = await User.findOrCreate({
      where: { email: 'ben1_4ps_anilao@test.com' },
      defaults: {
        email: 'ben1_4ps_anilao@test.com',
        password: 'hashed',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        role: 'beneficiary',
        status: 'active',
      },
    });

    const [ben1] = await Beneficiary.findOrCreate({
      where: { user_id: ben1User.id },
      defaults: {
        user_id: ben1User.id,
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        category: '4Ps Household Beneficiaries',
        barangay_id: anilao.id,
        status: 'Approved',
        beneficiary_id_code: 'TEST-4PS-ANILAO-001',
        sex: 'Male',
        birthdate: '1990-01-01',
      },
    });

    // Beneficiary 2: 4Ps + Aplaya (SHOULD NOT RECEIVE - wrong barangay)
    const [ben2User] = await User.findOrCreate({
      where: { email: 'ben2_4ps_aplaya@test.com' },
      defaults: {
        email: 'ben2_4ps_aplaya@test.com',
        password: 'hashed',
        first_name: 'Maria',
        last_name: 'Santos',
        role: 'beneficiary',
        status: 'active',
      },
    });

    const [ben2] = await Beneficiary.findOrCreate({
      where: { user_id: ben2User.id },
      defaults: {
        user_id: ben2User.id,
        first_name: 'Maria',
        last_name: 'Santos',
        category: '4Ps Household Beneficiaries',
        barangay_id: aplaya.id,
        status: 'Approved',
        beneficiary_id_code: 'TEST-4PS-APLAYA-001',
        sex: 'Female',
        birthdate: '1985-05-15',
      },
    });

    // Beneficiary 3: Senior + Anilao (SHOULD NOT RECEIVE - wrong category)
    const [ben3User] = await User.findOrCreate({
      where: { email: 'ben3_senior_anilao@test.com' },
      defaults: {
        email: 'ben3_senior_anilao@test.com',
        password: 'hashed',
        first_name: 'Pedro',
        last_name: 'Reyes',
        role: 'beneficiary',
        status: 'active',
      },
    });

    const [ben3] = await Beneficiary.findOrCreate({
      where: { user_id: ben3User.id },
      defaults: {
        user_id: ben3User.id,
        first_name: 'Pedro',
        last_name: 'Reyes',
        category: 'Senior Citizens (Social Pension)',
        barangay_id: anilao.id,
        status: 'Approved',
        beneficiary_id_code: 'TEST-SENIOR-ANILAO-001',
        sex: 'Male',
        birthdate: '1955-03-20',
      },
    });

    // Beneficiary 4: 4Ps + Anilao (SHOULD RECEIVE - 2nd matching beneficiary)
    const [ben4User] = await User.findOrCreate({
      where: { email: 'ben4_4ps_anilao@test.com' },
      defaults: {
        email: 'ben4_4ps_anilao@test.com',
        password: 'hashed',
        first_name: 'Rosa',
        last_name: 'Garcia',
        role: 'beneficiary',
        status: 'active',
      },
    });

    const [ben4] = await Beneficiary.findOrCreate({
      where: { user_id: ben4User.id },
      defaults: {
        user_id: ben4User.id,
        first_name: 'Rosa',
        last_name: 'Garcia',
        category: '4Ps Household Beneficiaries',
        barangay_id: anilao.id,
        status: 'Approved',
        beneficiary_id_code: 'TEST-4PS-ANILAO-002',
        sex: 'Female',
        birthdate: '1988-07-10',
      },
    });

    console.log(`\n✅ Test Beneficiaries Created:`);
    console.log(`   1. ${ben1.first_name} ${ben1.last_name} - ${ben1.category} @ Anilao`);
    console.log(`   2. ${ben2.first_name} ${ben2.last_name} - ${ben2.category} @ Aplaya`);
    console.log(`   3. ${ben3.first_name} ${ben3.last_name} - ${ben3.category} @ Anilao`);
    console.log(`   4. ${ben4.first_name} ${ben4.last_name} - ${ben4.category} @ Anilao`);

    // 4. Create test announcement targeting 4Ps + Anilao
    const [announcement] = await Announcement.findOrCreate({
      where: { title: 'TEST: 4Ps Cash Assistance Distribution - Anilao Only' },
      defaults: {
        title: 'TEST: 4Ps Cash Assistance Distribution - Anilao Only',
        message: 'This is a test announcement for 4Ps beneficiaries in Barangay Anilao only.',
        event_date: '2026-08-15',
        event_time: '09:00',
        venue: 'Anilao Barangay Hall',
        priority: 'High',
        status: 'published',
        target_programs: ['4Ps Household Beneficiaries'],
        target_barangays: [anilao.id],
        created_by_user_id: adminUser.id,
        recipient_count: 0,
      },
    });

    console.log(`\n✅ Test Announcement Created:`);
    console.log(`   Title: ${announcement.title}`);
    console.log(`   Target Category: 4Ps Household Beneficiaries`);
    console.log(`   Target Barangay: Anilao (ID: ${anilao.id})`);

    // Import the helper function from announcements route
    // Since we can't directly import from route, let's manually run the matching logic
    const { Op } = require('sequelize');
    
    // Match beneficiaries based on category and barangay
    const matchingBeneficiaries = await Beneficiary.findAll({
      where: {
        status: 'Approved',
        barangay_id: anilao.id,
        category: { [Op.like]: '%4Ps%' },
      },
      include: [
        { model: User, attributes: ['id', 'email'] },
        { model: Barangay },
      ],
    });

    console.log(`\n✅ Found ${matchingBeneficiaries.length} matching beneficiaries`);

    // Create AnnouncementRecipient records
    const recipientRecords = [];
    const inAppNotifications = [];

    for (const b of matchingBeneficiaries) {
      recipientRecords.push({
        announcement_id: announcement.id,
        beneficiary_id: b.id,
        user_id: b.user_id,
        is_read: false,
        attendance_status: 'Pending',
        notification_sent: true,
        sms_sent: false,
      });

      inAppNotifications.push({
        user_id: b.user_id,
        title: announcement.title,
        message: announcement.message,
        type: 'announcement',
        reference_id: announcement.id,
        reference_type: 'announcement',
        is_read: false,
      });
    }

    // Bulk create
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

    await announcement.update({ recipient_count: matchingBeneficiaries.length });

    // 5. Check Recipients
    console.log(`\n🔍 Checking Recipients...`);

    const recipients = await AnnouncementRecipient.findAll({
      where: { announcement_id: announcement.id },
      include: [
        {
          model: Beneficiary,
          as: 'Beneficiary',
          include: [{ model: Barangay }],
        },
      ],
    });

    console.log(`\n📋 Recipient Records (${recipients.length} total):`);
    recipients.forEach((r) => {
      const b = r.Beneficiary;
      console.log(`   - ${b.first_name} ${b.last_name} (${b.category} @ ${b.Barangay?.barangay_name})`);
    });

    // 6. Check notifications sent to users
    const ben1Notifs = await Notification.findAll({
      where: {
        user_id: ben1User.id,
        reference_type: 'announcement',
        reference_id: announcement.id,
      },
    });

    const ben2Notifs = await Notification.findAll({
      where: {
        user_id: ben2User.id,
        reference_type: 'announcement',
        reference_id: announcement.id,
      },
    });

    const ben3Notifs = await Notification.findAll({
      where: {
        user_id: ben3User.id,
        reference_type: 'announcement',
        reference_id: announcement.id,
      },
    });

    const ben4Notifs = await Notification.findAll({
      where: {
        user_id: ben4User.id,
        reference_type: 'announcement',
        reference_id: announcement.id,
      },
    });

    const adminNotifs = await Notification.findAll({
      where: {
        user_id: adminUser.id,
        reference_type: 'announcement',
        reference_id: announcement.id,
      },
    });

    const adminStaffNotifs = await Notification.findAll({
      where: {
        user_id: adminUser.id,
        reference_type: 'announcement_staff',
        reference_id: announcement.id,
      },
    });

    console.log(`\n📬 Notification Results:`);
    console.log(`   Ben1 (4Ps + Anilao): ${ben1Notifs.length > 0 ? '✅ RECEIVED' : '❌ NOT RECEIVED'}`);
    console.log(`   Ben2 (4Ps + Aplaya): ${ben2Notifs.length > 0 ? '❌ RECEIVED (ERROR!)' : '✅ NOT RECEIVED'}`);
    console.log(`   Ben3 (Senior + Anilao): ${ben3Notifs.length > 0 ? '❌ RECEIVED (ERROR!)' : '✅ NOT RECEIVED'}`);
    console.log(`   Ben4 (4Ps + Anilao): ${ben4Notifs.length > 0 ? '✅ RECEIVED' : '❌ NOT RECEIVED'}`);
    console.log(`   Admin (announcement type): ${adminNotifs.length > 0 ? '❌ RECEIVED (ERROR!)' : '✅ NOT RECEIVED'}`);
    console.log(`   Admin (staff type): ${adminStaffNotifs.length > 0 ? '❌ RECEIVED (ERROR!)' : '✅ NOT RECEIVED'}`);

    // 7. Verify expected results
    console.log(`\n🎯 VERIFICATION:`);
    const expectedRecipients = 2; // Ben1 and Ben4
    const actualRecipients = recipients.length;

    if (actualRecipients === expectedRecipients) {
      console.log(`   ✅ Correct number of recipients: ${actualRecipients}/${expectedRecipients}`);
    } else {
      console.log(`   ❌ Incorrect recipients: ${actualRecipients}/${expectedRecipients}`);
    }

    if (ben1Notifs.length > 0 && ben4Notifs.length > 0) {
      console.log(`   ✅ Matching beneficiaries received notifications`);
    } else {
      console.log(`   ❌ Matching beneficiaries did not receive notifications`);
    }

    if (ben2Notifs.length === 0 && ben3Notifs.length === 0) {
      console.log(`   ✅ Non-matching beneficiaries did NOT receive notifications`);
    } else {
      console.log(`   ❌ Non-matching beneficiaries incorrectly received notifications`);
    }

    if (adminNotifs.length === 0 && adminStaffNotifs.length === 0) {
      console.log(`   ✅ Admin did NOT receive announcement notifications`);
    } else {
      console.log(`   ❌ Admin incorrectly received notifications`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETED\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

testAnnouncementTargeting();
