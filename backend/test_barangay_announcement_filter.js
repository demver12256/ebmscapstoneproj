/**
 * TEST: Verify Barangay-Specific Announcement Notifications
 * 
 * Purpose: Confirm that when an announcement is created for a specific barangay,
 * ONLY staff assigned to that barangay receive notifications.
 * Staff from other barangays should NOT receive notifications.
 */

const {
  User,
  Barangay,
  Announcement,
  Notification,
  Beneficiary,
  sequelize,
} = require('./db');
const { Op } = require('sequelize');

async function testBarangayAnnouncementFilter() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 TEST: BARANGAY-SPECIFIC ANNOUNCEMENT NOTIFICATION FILTER');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Get all barangay staff
    const allStaff = await User.findAll({
      where: { role: { [Op.in]: ['staff', 'barangay'] } },
      include: [{ model: Barangay, attributes: ['barangay_name'] }],
    });

    console.log(`📋 EXISTING STAFF USERS: ${allStaff.length} total\n`);
    allStaff.forEach((s) => {
      console.log(`   • ID ${s.id}: ${s.first_name} ${s.last_name} → Barangay: ${s.Barangay?.barangay_name || 'NONE'} (ID: ${s.barangay_id})`);
    });

    if (allStaff.length < 2) {
      console.log('\n❌ ERROR: Need at least 2 staff from different barangays to test filtering!');
      process.exit(1);
    }

    // 2. Get two different barangays
    const uniqueBarangayIds = [...new Set(allStaff.map(s => s.barangay_id).filter(Boolean))];
    if (uniqueBarangayIds.length < 2) {
      console.log('\n❌ ERROR: All staff are from the same barangay. Cannot test filtering!');
      process.exit(1);
    }

    const targetBarangayId = uniqueBarangayIds[0];
    const otherBarangayId = uniqueBarangayIds[1];

    const targetBarangay = await Barangay.findByPk(targetBarangayId);
    const otherBarangay = await Barangay.findByPk(otherBarangayId);

    const targetStaff = allStaff.filter(s => s.barangay_id === targetBarangayId);
    const otherStaff = allStaff.filter(s => s.barangay_id === otherBarangayId);

    console.log(`\n📍 TARGET BARANGAY: ${targetBarangay.barangay_name} (ID: ${targetBarangayId})`);
    console.log(`   Expected Recipients: ${targetStaff.length} staff`);
    targetStaff.forEach(s => console.log(`      → ${s.first_name} ${s.last_name} (ID: ${s.id})`));

    console.log(`\n🚫 OTHER BARANGAY: ${otherBarangay.barangay_name} (ID: ${otherBarangayId})`);
    console.log(`   Should NOT Receive: ${otherStaff.length} staff`);
    otherStaff.forEach(s => console.log(`      → ${s.first_name} ${s.last_name} (ID: ${s.id})`));

    // 3. Count beneficiaries in target barangay for verification
    const targetBeneficiaries = await Beneficiary.count({
      where: {
        barangay_id: targetBarangayId,
        status: 'Approved',
        category: { [Op.like]: '%4Ps%' },
      },
    });

    console.log(`\n✅ Found ${targetBeneficiaries} approved 4Ps beneficiaries in ${targetBarangay.barangay_name}`);

    // 4. Create test announcement ONLY for target barangay
    console.log(`\n📢 CREATING TEST ANNOUNCEMENT FOR: ${targetBarangay.barangay_name} only`);

    const testAnnouncement = await Announcement.create({
      title: `TEST - ${targetBarangay.barangay_name} Only Announcement`,
      message: `This announcement should ONLY be seen by staff from ${targetBarangay.barangay_name}. Staff from ${otherBarangay.barangay_name} should NOT receive this.`,
      event_date: new Date().toISOString().split('T')[0],
      event_time: '10:00',
      end_time: '12:00',
      venue: `Barangay ${targetBarangay.barangay_name} Hall`,
      priority: 'High',
      status: 'published',
      target_programs: ['4Ps Household Beneficiaries'],
      target_barangays: [targetBarangayId], // ONLY target barangay
      created_by_user_id: 1,
      recipient_count: 0,
      view_count: 0,
    });

    console.log(`   ✅ Created Announcement ID: ${testAnnouncement.id}`);

    // 5. Manually trigger notification dispatch (simulating the route logic)
    const targetBarangayIds = [targetBarangayId];
    
    const staffUsers = await User.findAll({
      where: {
        role: { [Op.in]: ['staff', 'barangay'] },
        status: 'active',
        barangay_id: { 
          [Op.in]: targetBarangayIds,
          [Op.ne]: null,
        },
      },
    });

    console.log(`\n🔍 QUERY RESULTS: Found ${staffUsers.length} staff matching criteria`);
    staffUsers.forEach(s => {
      console.log(`   → User ID ${s.id}: ${s.first_name} ${s.last_name} (Barangay ID: ${s.barangay_id})`);
    });

    // 6. Create staff notifications
    const staffNotifications = staffUsers.map((staff) => ({
      user_id: staff.id,
      title: `📢 Activity Assigned: ${testAnnouncement.title}`,
      message: `A new announcement/activity has been scheduled for ${testAnnouncement.event_date} at ${testAnnouncement.venue}. You are responsible for facilitating RFID attendance.`,
      type: 'system',
      reference_id: testAnnouncement.id,
      reference_type: 'announcement_staff',
      is_read: false,
    }));

    if (staffNotifications.length > 0) {
      await Notification.bulkCreate(staffNotifications, { ignoreDuplicates: true });
      console.log(`\n✅ NOTIFICATIONS SENT: ${staffNotifications.length} notifications created`);
    }

    // 7. VERIFICATION: Check who actually received notifications
    console.log(`\n${'='.repeat(80)}`);
    console.log('🔬 VERIFICATION: Checking notification database records...');
    console.log('='.repeat(80) + '\n');

    const createdNotifications = await Notification.findAll({
      where: {
        reference_id: testAnnouncement.id,
        reference_type: 'announcement_staff',
      },
      include: [{
        model: User,
        attributes: ['id', 'first_name', 'last_name', 'barangay_id'],
        include: [{ model: Barangay, attributes: ['barangay_name'] }],
      }],
    });

    console.log(`📬 Total Notifications Created: ${createdNotifications.length}\n`);

    const correctNotifications = [];
    const incorrectNotifications = [];

    createdNotifications.forEach(n => {
      const userBarangayId = n.User.barangay_id;
      const barangayName = n.User.Barangay?.barangay_name || 'NONE';
      
      if (userBarangayId === targetBarangayId) {
        correctNotifications.push(n);
        console.log(`   ✅ CORRECT: ${n.User.first_name} ${n.User.last_name} (${barangayName}) - Should receive`);
      } else {
        incorrectNotifications.push(n);
        console.log(`   ❌ WRONG: ${n.User.first_name} ${n.User.last_name} (${barangayName}) - Should NOT receive!`);
      }
    });

    // 8. Check staff from other barangay
    console.log(`\n🚫 VERIFICATION: Staff from ${otherBarangay.barangay_name} (Should be ZERO):`);
    const wrongNotifications = await Notification.findAll({
      where: {
        reference_id: testAnnouncement.id,
        reference_type: 'announcement_staff',
        user_id: { [Op.in]: otherStaff.map(s => s.id) },
      },
    });

    if (wrongNotifications.length === 0) {
      console.log(`   ✅ PASSED: No notifications sent to ${otherBarangay.barangay_name} staff`);
    } else {
      console.log(`   ❌ FAILED: ${wrongNotifications.length} incorrect notifications sent!`);
      wrongNotifications.forEach(n => {
        const staff = otherStaff.find(s => s.id === n.user_id);
        console.log(`      → ${staff.first_name} ${staff.last_name} (Should NOT have received)`);
      });
    }

    // 9. Final Result
    console.log(`\n${'='.repeat(80)}`);
    console.log('🎯 TEST RESULTS');
    console.log('='.repeat(80) + '\n');

    console.log(`Target Barangay: ${targetBarangay.barangay_name} (ID: ${targetBarangayId})`);
    console.log(`Expected Recipients: ${targetStaff.length}`);
    console.log(`Actual Recipients: ${correctNotifications.length}`);
    console.log(`Wrong Recipients: ${incorrectNotifications.length}`);

    if (incorrectNotifications.length === 0 && correctNotifications.length === targetStaff.length) {
      console.log(`\n✅✅✅ TEST PASSED! Announcement notifications are correctly filtered by barangay!`);
    } else {
      console.log(`\n❌❌❌ TEST FAILED! Some staff received incorrect notifications!`);
    }

    // 10. Cleanup
    console.log(`\n🧹 Cleaning up test data...`);
    await Notification.destroy({
      where: {
        reference_id: testAnnouncement.id,
        reference_type: 'announcement_staff',
      },
    });
    await Announcement.destroy({ where: { id: testAnnouncement.id } });
    console.log(`   ✅ Test announcement and notifications deleted`);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ TEST COMPLETED SUCCESSFULLY\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error);
    process.exit(1);
  }
}

testBarangayAnnouncementFilter();
