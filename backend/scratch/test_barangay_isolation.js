const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function makeRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData) });
        } catch(e) {
          resolve({ status: res.statusCode, body: resData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log('=== STARTING BARANGAY ANNOUNCEMENT & NOTIFICATION ISOLATION TEST ===');

  // Token generation
  const adminToken = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  const anilaoStaffToken = jwt.sign({ id: 106, role: 'staff', barangay_id: 37 }, JWT_SECRET, { expiresIn: '1h' });
  const aplayaStaffToken = jwt.sign({ id: 108, role: 'staff', barangay_id: 38 }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Create announcement for Anilao ONLY (bgy 37)
  const testTitle = 'TEST ISOLATION: Payout Anilao Only ' + Date.now();
  console.log('\n1. Admin creating announcement targeting ONLY Barangay Anilao (ID: 37)...');
  const createRes = await makeRequest('POST', '/api/announcements', {
    title: testTitle,
    message: 'This is a test announcement exclusive to Anilao.',
    event_type: 'distribution',
    target_barangays: [37],
    target_programs: ['all'],
    event_date: '2026-09-20',
    event_time: '10:00',
    venue: 'Anilao Barangay Hall',
    status: 'published'
  }, adminToken);

  const announcementId = createRes.body?.data?.id || createRes.body?.announcement?.id || createRes.body?.id;
  console.log('Create announcement status:', createRes.status, 'ID:', announcementId);
  if (!announcementId) {
    console.error('Failed to create test announcement:', createRes.body);
    process.exit(1);
  }

  // 2. Test staff notification retrieval
  console.log('\n2. Testing Notifications:');
  const anilaoNotifs = await makeRequest('GET', '/api/notifications', null, anilaoStaffToken);
  const aplayaNotifs = await makeRequest('GET', '/api/notifications', null, aplayaStaffToken);

  const anilaoNotifsList = anilaoNotifs.body?.data || [];
  const aplayaNotifsList = aplayaNotifs.body?.data || [];

  const anilaoHasNotif = anilaoNotifsList.some(n => (n.title && n.title.includes(testTitle)) || (n.message && n.message.includes(testTitle)));
  const aplayaHasNotif = aplayaNotifsList.some(n => (n.title && n.title.includes(testTitle)) || (n.message && n.message.includes(testTitle)));

  console.log(`- Anilao Staff (ID: 106, bgy 37) received notification? ${anilaoHasNotif ? '✅ YES' : '❌ NO'}`);
  console.log(`- Aplaya Staff (ID: 108, bgy 38) received notification? ${aplayayaHasNotif = aplayaHasNotif ? '❌ LEAKED!' : '✅ NO (Correctly Isolated)'}`);

  // 3. Test announcement list retrieval (GET /api/announcements)
  console.log('\n3. Testing Announcement List Visibility:');
  const anilaoList = await makeRequest('GET', '/api/announcements', null, anilaoStaffToken);
  const aplayaList = await makeRequest('GET', '/api/announcements', null, aplayaStaffToken);

  const anilaoListItems = anilaoList.body?.data || [];
  const aplayaListItems = aplayaList.body?.data || [];

  const anilaoListHasIt = anilaoListItems.some(a => a.id === announcementId);
  const aplayaListHasIt = aplayaListItems.some(a => a.id === announcementId);

  console.log(`- Anilao Staff sees announcement in list? ${anilaoListHasIt ? '✅ YES' : '❌ NO'}`);
  console.log(`- Aplaya Staff sees announcement in list? ${aplayayaListHasIt = aplayaListHasIt ? '❌ LEAKED!' : '✅ NO (Correctly Hidden)'}`);

  // 4. Test direct GET /api/announcements/:id for forbidden access
  console.log('\n4. Testing Direct Access (GET /api/announcements/:id):');
  const anilaoDirect = await makeRequest('GET', `/api/announcements/${announcementId}`, null, anilaoStaffToken);
  const aplayaDirect = await makeRequest('GET', `/api/announcements/${announcementId}`, null, aplayaStaffToken);

  console.log(`- Anilao Staff access status: ${anilaoDirect.status} ${anilaoDirect.status === 200 ? '✅ (200 OK)' : '❌'}`);
  console.log(`- Aplaya Staff access status: ${aplayayDirect = aplayaDirect.status} ${aplayayDirect === 403 ? '✅ (403 Forbidden - Correctly Blocked)' : '❌'}`);

  // 5. Cleanup
  console.log('\n5. Cleaning up test announcement & notifications...');
  const { Announcement, Notification } = require('../db');
  await Notification.destroy({ where: { reference_id: [announcementId, 75], reference_type: 'announcement_staff' } });
  await Announcement.destroy({ where: { id: [announcementId, 75] } });
  console.log('Cleanup complete.');

  if (anilaoHasNotif && !aplayaHasNotif && anilaoListHasIt && !aplayaListHasIt && aplayaDirect.status === 403) {
    console.log('\n🎉 ALL ISOLATION TESTS PASSED PERFECTLY!');
  } else {
    console.log('\n⚠️ SOME TESTS FAILED. Please review results above.');
  }

  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
