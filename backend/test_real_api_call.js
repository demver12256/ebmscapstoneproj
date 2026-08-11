/**
 * TEST: Real API Call to verify filtering
 * 
 * This will simulate actual login and API calls from frontend
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000/api';

async function testRealApiCall() {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 TESTING REAL API CALLS');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Login as Sergio (Aplaya staff)
    console.log('📝 Step 1: Login as Sergio Folloso (Aplaya staff)...');
    const sergioLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sergiofolloso@example.com',
        password: 'password123',
      }),
    });

    const sergioData = await sergioLogin.json();
    if (!sergioData.success) {
      console.log('❌ ERROR: Login failed for Sergio');
      console.log('Response:', sergioData);
      process.exit(1);
    }

    const sergioToken = sergioData.data.token;
    console.log('✅ Logged in as:', sergioData.data.user.first_name, sergioData.data.user.last_name);
    console.log('   Role:', sergioData.data.user.role);
    console.log('   Barangay ID:', sergioData.data.user.barangay_id);
    console.log('   Token:', sergioToken.substring(0, 20) + '...\n');

    // 2. Get announcements as Sergio
    console.log('📋 Step 2: Fetching announcements as Sergio (Aplaya staff)...');
    const sergioAnnouncements = await fetch(`${BASE_URL}/announcements`, {
      headers: {
        'Authorization': `Bearer ${sergioToken}`,
        'Content-Type': 'application/json',
      },
    });

    const sergioAnnouncementsData = await sergioAnnouncements.json();
    console.log('Response Status:', sergioAnnouncements.status);
    console.log('Response Data:', JSON.stringify(sergioAnnouncementsData, null, 2));
    
    if (sergioAnnouncementsData.success) {
      const announcements = sergioAnnouncementsData.data || [];
      console.log(`\n📬 Sergio sees ${announcements.length} announcements:\n`);
      
      announcements.forEach(ann => {
        console.log(`   • ${ann.title}`);
        console.log(`     Target Barangays: ${JSON.stringify(ann.target_barangays)}`);
        console.log(`     Status: ${ann.status}`);
        console.log('');
      });

      // Check if Sergio sees any Anilao (barangay_id: 37) announcements
      const wrongAnnouncements = announcements.filter(ann => 
        Array.isArray(ann.target_barangays) && ann.target_barangays.includes(37)
      );

      if (wrongAnnouncements.length > 0) {
        console.log('❌ FAIL: Sergio (Aplaya staff) is seeing Anilao announcements!');
        wrongAnnouncements.forEach(ann => {
          console.log(`   ❌ "${ann.title}" - Target Barangays: ${JSON.stringify(ann.target_barangays)}`);
        });
      } else {
        console.log('✅ PASS: Sergio is NOT seeing Anilao announcements');
      }
    } else {
      console.log('❌ ERROR:', sergioAnnouncementsData.message);
    }

    console.log('\n' + '='.repeat(80));

    // 3. Login as Demver (Anilao staff)
    console.log('\n📝 Step 3: Login as Demver Minion (Anilao staff)...');
    const demverLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demverminion@example.com',
        password: 'password123',
      }),
    });

    const demverData = await demverLogin.json();
    if (!demverData.success) {
      console.log('❌ ERROR: Login failed for Demver');
      console.log('Response:', demverData);
      process.exit(1);
    }

    const demverToken = demverData.data.token;
    console.log('✅ Logged in as:', demverData.data.user.first_name, demverData.data.user.last_name);
    console.log('   Role:', demverData.data.user.role);
    console.log('   Barangay ID:', demverData.data.user.barangay_id);
    console.log('   Token:', demverToken.substring(0, 20) + '...\n');

    // 4. Get announcements as Demver
    console.log('📋 Step 4: Fetching announcements as Demver (Anilao staff)...');
    const demverAnnouncements = await fetch(`${BASE_URL}/announcements`, {
      headers: {
        'Authorization': `Bearer ${demverToken}`,
        'Content-Type': 'application/json',
      },
    });

    const demverAnnouncementsData = await demverAnnouncements.json();
    console.log('Response Status:', demverAnnouncements.status);
    
    if (demverAnnouncementsData.success) {
      const announcements = demverAnnouncementsData.data || [];
      console.log(`\n📬 Demver sees ${announcements.length} announcements:\n`);
      
      announcements.forEach(ann => {
        console.log(`   • ${ann.title}`);
        console.log(`     Target Barangays: ${JSON.stringify(ann.target_barangays)}`);
        console.log(`     Status: ${ann.status}`);
        console.log('');
      });

      // Check if Demver sees any Aplaya (barangay_id: 38) announcements
      const wrongAnnouncements = announcements.filter(ann => 
        Array.isArray(ann.target_barangays) && ann.target_barangays.includes(38)
      );

      if (wrongAnnouncements.length > 0) {
        console.log('❌ FAIL: Demver (Anilao staff) is seeing Aplaya announcements!');
        wrongAnnouncements.forEach(ann => {
          console.log(`   ❌ "${ann.title}" - Target Barangays: ${JSON.stringify(ann.target_barangays)}`);
        });
      } else {
        console.log('✅ PASS: Demver is NOT seeing Aplaya announcements');
      }
    } else {
      console.log('❌ ERROR:', demverAnnouncementsData.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETED\n');

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    process.exit(1);
  }
}

testRealApiCall();
