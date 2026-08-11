/**
 * TEST: Staff Announcement View Filtering
 * 
 * Purpose: Verify that staff users can ONLY see announcements 
 * targeting their assigned barangay when viewing the announcements list.
 */

const express = require('express');
const {
  User,
  Barangay,
  Announcement,
  sequelize,
} = require('./db');

const announcementsRouter = require('./routes/announcements');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
  if (req.headers['x-user-id']) {
    User.findByPk(req.headers['x-user-id']).then(user => {
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'No user' });
  }
});

app.use('/api/announcements', announcementsRouter);

async function testStaffAnnouncementViewFilter() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 TEST: STAFF ANNOUNCEMENT VIEW FILTERING');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Get test users
    const sergioAplaya = await User.findOne({
      where: { first_name: 'Sergio', last_name: 'Folloso' },
      include: [{ model: Barangay }],
    });

    const demverAnilao = await User.findOne({
      where: { first_name: 'Demver', last_name: 'Minion' },
      include: [{ model: Barangay }],
    });

    if (!sergioAplaya || !demverAnilao) {
      console.log('❌ ERROR: Test users not found!');
      process.exit(1);
    }

    console.log('👥 TEST USERS:');
    console.log(`   • ${sergioAplaya.first_name} ${sergioAplaya.last_name} (ID: ${sergioAplaya.id})`);
    console.log(`     Role: ${sergioAplaya.role} | Barangay: ${sergioAplaya.Barangay.barangay_name} (ID: ${sergioAplaya.barangay_id})`);
    console.log(`   • ${demverAnilao.first_name} ${demverAnilao.last_name} (ID: ${demverAnilao.id})`);
    console.log(`     Role: ${demverAnilao.role} | Barangay: ${demverAnilao.Barangay.barangay_name} (ID: ${demverAnilao.barangay_id})\n`);

    // 2. Create test announcements for different barangays
    console.log('📢 CREATING TEST ANNOUNCEMENTS...\n');

    const anilaoBrgy = await Barangay.findByPk(demverAnilao.barangay_id);
    const aplayaBrgy = await Barangay.findByPk(sergioAplaya.barangay_id);

    const anilaoAnnouncement = await Announcement.create({
      title: `TEST - ${anilaoBrgy.barangay_name} Only Announcement`,
      message: `This is for ${anilaoBrgy.barangay_name} staff only`,
      event_date: new Date().toISOString().split('T')[0],
      venue: `${anilaoBrgy.barangay_name} Hall`,
      priority: 'High',
      status: 'published',
      target_programs: ['4Ps Household Beneficiaries'],
      target_barangays: [demverAnilao.barangay_id],
      created_by_user_id: 1,
      recipient_count: 5,
    });

    console.log(`   ✅ Created announcement for ${anilaoBrgy.barangay_name} (ID: ${anilaoAnnouncement.id})`);
    console.log(`      Target Barangays: [${demverAnilao.barangay_id}]`);

    const aplayaAnnouncement = await Announcement.create({
      title: `TEST - ${aplayaBrgy.barangay_name} Only Announcement`,
      message: `This is for ${aplayaBrgy.barangay_name} staff only`,
      event_date: new Date().toISOString().split('T')[0],
      venue: `${aplayaBrgy.barangay_name} Hall`,
      priority: 'High',
      status: 'published',
      target_programs: ['Senior Citizens (Social Pension)'],
      target_barangays: [sergioAplaya.barangay_id],
      created_by_user_id: 1,
      recipient_count: 3,
    });

    console.log(`   ✅ Created announcement for ${aplayaBrgy.barangay_name} (ID: ${aplayaAnnouncement.id})`);
    console.log(`      Target Barangays: [${sergioAplaya.barangay_id}]\n`);

    // 3. Start test server
    const server = app.listen(5097, async () => {
      const BASE = 'http://127.0.0.1:5097/api/announcements';

      console.log('='.repeat(80));
      console.log('🔬 TESTING API RESPONSES');
      console.log('='.repeat(80) + '\n');

      // 4. Test Sergio (Aplaya staff) view
      console.log(`📋 TEST 1: ${sergioAplaya.first_name} (${aplayaBrgy.barangay_name} staff) views announcements`);
      
      const sergioRes = await fetch(BASE, {
        headers: { 'x-user-id': sergioAplaya.id.toString() },
      });
      const sergioData = await sergioRes.json();
      const sergioAnnouncements = sergioData.data || [];

      console.log(`   Response: ${sergioAnnouncements.length} announcements returned`);
      
      let sergioSeesAnilao = false;
      let sergioSeesAplaya = false;

      sergioAnnouncements.forEach(ann => {
        if (ann.id === anilaoAnnouncement.id) {
          sergioSeesAnilao = true;
          console.log(`      ❌ WRONG: Sees ${anilaoBrgy.barangay_name} announcement (should NOT see)`);
        }
        if (ann.id === aplayaAnnouncement.id) {
          sergioSeesAplaya = true;
          console.log(`      ✅ CORRECT: Sees ${aplayaBrgy.barangay_name} announcement`);
        }
      });

      const sergioTestPassed = !sergioSeesAnilao && sergioSeesAplaya;
      console.log(`   Result: ${sergioTestPassed ? '✅ PASSED' : '❌ FAILED'}\n`);

      // 5. Test Demver (Anilao staff) view
      console.log(`📋 TEST 2: ${demverAnilao.first_name} (${anilaoBrgy.barangay_name} staff) views announcements`);
      
      const demverRes = await fetch(BASE, {
        headers: { 'x-user-id': demverAnilao.id.toString() },
      });
      const demverData = await demverRes.json();
      const demverAnnouncements = demverData.data || [];

      console.log(`   Response: ${demverAnnouncements.length} announcements returned`);
      
      let demverSeesAnilao = false;
      let demverSeesAplaya = false;

      demverAnnouncements.forEach(ann => {
        if (ann.id === anilaoAnnouncement.id) {
          demverSeesAnilao = true;
          console.log(`      ✅ CORRECT: Sees ${anilaoBrgy.barangay_name} announcement`);
        }
        if (ann.id === aplayaAnnouncement.id) {
          demverSeesAplaya = true;
          console.log(`      ❌ WRONG: Sees ${aplayaBrgy.barangay_name} announcement (should NOT see)`);
        }
      });

      const demverTestPassed = demverSeesAnilao && !demverSeesAplaya;
      console.log(`   Result: ${demverTestPassed ? '✅ PASSED' : '❌ FAILED'}\n`);

      // 6. Final Results
      console.log('='.repeat(80));
      console.log('🎯 FINAL TEST RESULTS');
      console.log('='.repeat(80) + '\n');

      console.log(`${aplayaBrgy.barangay_name} Staff (Sergio) Test: ${sergioTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   • Should see ${aplayaBrgy.barangay_name} announcements: ${sergioSeesAplaya ? '✅' : '❌'}`);
      console.log(`   • Should NOT see ${anilaoBrgy.barangay_name} announcements: ${!sergioSeesAnilao ? '✅' : '❌'}`);

      console.log(`\n${anilaoBrgy.barangay_name} Staff (Demver) Test: ${demverTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   • Should see ${anilaoBrgy.barangay_name} announcements: ${demverSeesAnilao ? '✅' : '❌'}`);
      console.log(`   • Should NOT see ${aplayaBrgy.barangay_name} announcements: ${!demverSeesAplaya ? '✅' : '❌'}`);

      if (sergioTestPassed && demverTestPassed) {
        console.log(`\n✅✅✅ ALL TESTS PASSED! Staff can only see announcements for their barangay!`);
      } else {
        console.log(`\n❌❌❌ TESTS FAILED! Staff are seeing announcements from other barangays!`);
      }

      // 7. Cleanup
      console.log(`\n🧹 Cleaning up test data...`);
      await Announcement.destroy({
        where: { id: [anilaoAnnouncement.id, aplayaAnnouncement.id] },
      });
      console.log(`   ✅ Test announcements deleted\n`);

      server.close();
      process.exit(sergioTestPassed && demverTestPassed ? 0 : 1);
    });

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error);
    process.exit(1);
  }
}

testStaffAnnouncementViewFilter();
