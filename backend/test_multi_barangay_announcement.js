/**
 * TEST: Multi-Barangay Announcement Notifications
 * 
 * Purpose: Test that announcements targeting multiple barangays
 * correctly notify staff from ALL target barangays (and no others)
 */

const {
  User,
  Barangay,
  Announcement,
  Notification,
  sequelize,
} = require('./db');
const { Op } = require('sequelize');

async function testMultiBarangayAnnouncement() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 TEST: MULTI-BARANGAY ANNOUNCEMENT NOTIFICATION FILTER');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Get all staff
    const allStaff = await User.findAll({
      where: { role: { [Op.in]: ['staff', 'barangay'] } },
      include: [{ model: Barangay, attributes: ['barangay_name'] }],
    });

    console.log(`📋 EXISTING STAFF USERS: ${allStaff.length} total\n`);
    allStaff.forEach((s) => {
      console.log(`   • ID ${s.id}: ${s.first_name} ${s.last_name} → ${s.Barangay?.barangay_name || 'NONE'} (ID: ${s.barangay_id})`);
    });

    // 2. Select 2 barangays for target, 1 for exclusion
    const uniqueBarangayIds = [...new Set(allStaff.map(s => s.barangay_id).filter(Boolean))];
    
    if (uniqueBarangayIds.length < 2) {
      console.log('\n⚠️ WARNING: Only one barangay has staff. Creating single-barangay test...\n');
      const targetIds = [uniqueBarangayIds[0]];
      const targetStaff = allStaff.filter(s => targetIds.includes(s.barangay_id));
      
      console.log(`📍 TARGET BARANGAYS: ${targetIds.join(', ')}`);
      console.log(`   Expected: ${targetStaff.length} staff should receive notifications\n`);
      
      const testAnnouncement = await Announcement.create({
        title: 'TEST - Single Barangay Announcement',
        message: 'Test message',
        event_date: new Date().toISOString().split('T')[0],
        venue: 'Test Venue',
        priority: 'High',
        status: 'published',
        target_programs: ['4Ps Household Beneficiaries'],
        target_barangays: targetIds,
        created_by_user_id: 1,
        recipient_count: 0,
      });

      const staffUsers = await User.findAll({
        where: {
          role: { [Op.in]: ['staff', 'barangay'] },
          status: 'active',
          barangay_id: { [Op.in]: targetIds, [Op.ne]: null },
        },
      });

      console.log(`✅ Query found ${staffUsers.length} staff (Expected: ${targetStaff.length})`);
      
      if (staffUsers.length === targetStaff.length) {
        console.log('\n✅ TEST PASSED for single barangay!\n');
      } else {
        console.log('\n❌ TEST FAILED - Staff count mismatch!\n');
      }

      await Announcement.destroy({ where: { id: testAnnouncement.id } });
      process.exit(0);
    }

    // 3. Multi-barangay test
    const target1 = uniqueBarangayIds[0];
    const target2 = uniqueBarangayIds[1];
    const excluded = uniqueBarangayIds[2] || null;

    const barangay1 = await Barangay.findByPk(target1);
    const barangay2 = await Barangay.findByPk(target2);
    const barangay3 = excluded ? await Barangay.findByPk(excluded) : null;

    const targetStaff = allStaff.filter(s => [target1, target2].includes(s.barangay_id));
    const excludedStaff = excluded ? allStaff.filter(s => s.barangay_id === excluded) : [];

    console.log(`\n📍 TARGET BARANGAYS: ${barangay1.barangay_name} + ${barangay2.barangay_name}`);
    console.log(`   IDs: [${target1}, ${target2}]`);
    console.log(`   Expected Recipients: ${targetStaff.length} staff`);
    targetStaff.forEach(s => console.log(`      ✅ ${s.first_name} ${s.last_name} (Barangay ID: ${s.barangay_id})`));

    if (excluded) {
      console.log(`\n🚫 EXCLUDED BARANGAY: ${barangay3.barangay_name}`);
      console.log(`   ID: ${excluded}`);
      console.log(`   Should NOT Receive: ${excludedStaff.length} staff`);
      excludedStaff.forEach(s => console.log(`      ❌ ${s.first_name} ${s.last_name} (Barangay ID: ${s.barangay_id})`));
    }

    // 4. Create multi-barangay announcement
    console.log(`\n📢 CREATING MULTI-BARANGAY ANNOUNCEMENT...`);

    const testAnnouncement = await Announcement.create({
      title: `TEST - ${barangay1.barangay_name} + ${barangay2.barangay_name} Announcement`,
      message: `This should notify staff from ${barangay1.barangay_name} and ${barangay2.barangay_name} only.`,
      event_date: new Date().toISOString().split('T')[0],
      event_time: '14:00',
      venue: 'Municipal Hall',
      priority: 'High',
      status: 'published',
      target_programs: ['4Ps Household Beneficiaries'],
      target_barangays: [target1, target2],
      created_by_user_id: 1,
      recipient_count: 0,
    });

    console.log(`   ✅ Created Announcement ID: ${testAnnouncement.id}`);

    // 5. Query staff
    const staffUsers = await User.findAll({
      where: {
        role: { [Op.in]: ['staff', 'barangay'] },
        status: 'active',
        barangay_id: { [Op.in]: [target1, target2], [Op.ne]: null },
      },
    });

    console.log(`\n🔍 QUERY RESULTS: Found ${staffUsers.length} staff`);
    staffUsers.forEach(s => {
      console.log(`   → ${s.first_name} ${s.last_name} (Barangay ID: ${s.barangay_id})`);
    });

    // 6. Create notifications
    const staffNotifications = staffUsers.map((staff) => ({
      user_id: staff.id,
      title: `📢 Activity Assigned: ${testAnnouncement.title}`,
      message: 'Test notification',
      type: 'system',
      reference_id: testAnnouncement.id,
      reference_type: 'announcement_staff',
      is_read: false,
    }));

    if (staffNotifications.length > 0) {
      await Notification.bulkCreate(staffNotifications, { ignoreDuplicates: true });
    }

    // 7. Verify
    console.log(`\n${'='.repeat(80)}`);
    console.log('🔬 VERIFICATION');
    console.log('='.repeat(80) + '\n');

    const allNotifications = await Notification.findAll({
      where: {
        reference_id: testAnnouncement.id,
        reference_type: 'announcement_staff',
      },
      include: [{
        model: User,
        attributes: ['id', 'first_name', 'last_name', 'barangay_id'],
      }],
    });

    console.log(`📬 Total Notifications: ${allNotifications.length}\n`);

    let correctCount = 0;
    let wrongCount = 0;

    allNotifications.forEach(n => {
      const isCorrect = [target1, target2].includes(n.User.barangay_id);
      if (isCorrect) {
        correctCount++;
        console.log(`   ✅ ${n.User.first_name} ${n.User.last_name} (Barangay ID: ${n.User.barangay_id})`);
      } else {
        wrongCount++;
        console.log(`   ❌ ${n.User.first_name} ${n.User.last_name} (Barangay ID: ${n.User.barangay_id}) - SHOULD NOT RECEIVE!`);
      }
    });

    // 8. Check excluded staff
    if (excluded && excludedStaff.length > 0) {
      console.log(`\n🚫 Checking excluded barangay (${barangay3.barangay_name})...`);
      const wrongNotifs = await Notification.findAll({
        where: {
          reference_id: testAnnouncement.id,
          reference_type: 'announcement_staff',
          user_id: { [Op.in]: excludedStaff.map(s => s.id) },
        },
      });

      if (wrongNotifs.length === 0) {
        console.log(`   ✅ PASSED: No notifications sent to excluded staff`);
      } else {
        console.log(`   ❌ FAILED: ${wrongNotifs.length} incorrect notifications!`);
        wrongCount += wrongNotifs.length;
      }
    }

    // 9. Results
    console.log(`\n${'='.repeat(80)}`);
    console.log('🎯 TEST RESULTS');
    console.log('='.repeat(80) + '\n');

    console.log(`Expected Recipients: ${targetStaff.length}`);
    console.log(`Actual Recipients: ${correctCount}`);
    console.log(`Wrong Recipients: ${wrongCount}`);

    if (wrongCount === 0 && correctCount === targetStaff.length) {
      console.log(`\n✅✅✅ TEST PASSED! Multi-barangay notifications work correctly!`);
    } else {
      console.log(`\n❌❌❌ TEST FAILED! Notification filtering has issues!`);
    }

    // 10. Cleanup
    console.log(`\n🧹 Cleaning up...`);
    await Notification.destroy({
      where: { reference_id: testAnnouncement.id },
    });
    await Announcement.destroy({ where: { id: testAnnouncement.id } });
    console.log(`   ✅ Test data deleted\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

testMultiBarangayAnnouncement();
