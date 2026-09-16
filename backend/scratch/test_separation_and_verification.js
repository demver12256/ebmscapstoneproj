const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { BenefitProgram, Announcement, Notification } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function makeRequest(method, reqPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: reqPath,
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
  console.log('=== STARTING SEPARATION & VERIFICATION ACCESS TEST ===');

  const dswdAdminToken = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  const mswdoAdminToken = jwt.sign({ id: 4217, role: 'mswdo_admin' }, JWT_SECRET, { expiresIn: '1h' });

  // ── TEST 1: Payout Account Verification Access ──
  console.log('\n--- TEST 1: Payout Account Verification Access ---');
  // Attempt verification using MSWDO token
  const mswdoVerifyRes = await makeRequest('POST', '/api/beneficiaries/3102/verify-payout-account', { force: true }, mswdoAdminToken);
  console.log('MSWDO verify status:', mswdoVerifyRes.status, mswdoVerifyRes.body?.message || '');
  const mswdoBlocked = mswdoVerifyRes.status === 403;
  console.log(`- MSWDO blocked from verifying payout account? ${mswdoBlocked ? '✅ YES (403 Forbidden)' : '❌ NO'}`);

  // Attempt verification using DSWD Admin token
  const dswdVerifyRes = await makeRequest('POST', '/api/beneficiaries/3102/verify-payout-account', { force: true }, dswdAdminToken);
  console.log('DSWD Admin verify status:', dswdVerifyRes.status, dswdVerifyRes.body?.message || '');
  const dswdAllowed = dswdVerifyRes.status !== 403;
  console.log(`- DSWD Admin allowed to access verification endpoint? ${dswdAllowed ? '✅ YES' : '❌ NO'}`);

  // ── TEST 2: Programs Separation & MSWDO 4Ps Creation ──
  console.log('\n--- TEST 2: Programs Separation & MSWDO 4Ps Creation ---');
  const testProgName = 'TEST MSWDO 4Ps Program ' + Date.now();
  const createProgRes = await makeRequest('POST', '/api/programs', {
    name: testProgName,
    description: 'Special LGU counterpart program for 4Ps households.',
    category: '4Ps Household Beneficiaries',
    barangay_id: 37,
    total_budget: 150000,
    start_date: '2026-09-20',
    end_date: '2026-10-20',
    status: 'active'
  }, mswdoAdminToken);

  console.log('MSWDO create 4Ps program status:', createProgRes.status);
  const createdProgId = createProgRes.body?.data?.id || createProgRes.body?.id;
  const createdProgAgency = createProgRes.body?.data?.agency || createProgRes.body?.agency;
  console.log(`- Program created ID: ${createdProgId}, Agency: ${createdProgAgency}`);
  const progCreatedSuccess = createProgRes.status === 201 && createdProgAgency === 'MSWDO';
  console.log(`- MSWDO successfully created 4Ps program under MSWDO agency? ${progCreatedSuccess ? '✅ YES' : '❌ NO'}`);

  // Check program visibility: DSWD Admin vs MSWDO
  const dswdProgsList = await makeRequest('GET', '/api/programs', null, dswdAdminToken);
  const mswdoProgsList = await makeRequest('GET', '/api/programs', null, mswdoAdminToken);

  const dswdSeesMswdoProg = Array.isArray(dswdProgsList.body?.data) && dswdProgsList.body.data.some(p => p.id === createdProgId);
  const mswdoSeesMswdoProg = Array.isArray(mswdoProgsList.body?.data) && mswdoProgsList.body.data.some(p => p.id === createdProgId);

  console.log(`- DSWD Admin sees MSWDO 4Ps program? ${dswdSeesMswdoProg ? '❌ LEAKED TO DSWD' : '✅ NO (Isolated from DSWD)'}`);
  console.log(`- MSWDO sees own MSWDO 4Ps program? ${mswdoSeesMswdoProg ? '✅ YES (Visible to MSWDO)' : '❌ NO'}`);

  // ── TEST 3: Announcements Separation & MSWDO 4Ps Creation ──
  console.log('\n--- TEST 3: Announcements Separation & MSWDO 4Ps Creation ---');
  const testAnnTitle = 'TEST MSWDO 4Ps Announcement ' + Date.now();
  const createAnnRes = await makeRequest('POST', '/api/announcements', {
    title: testAnnTitle,
    message: 'Announcement for 4Ps households by MSWDO municipal office.',
    target_categories: ['4Ps Household Beneficiaries'],
    target_barangays: [37],
    event_date: '2026-09-25',
    event_time: '09:00',
    venue: 'Municipal Gymnasium',
    status: 'published'
  }, mswdoAdminToken);

  console.log('MSWDO create 4Ps announcement status:', createAnnRes.status);
  const createdAnnId = createAnnRes.body?.data?.id || createAnnRes.body?.id;
  const annCreatedSuccess = createAnnRes.status === 201 && createdAnnId;
  console.log(`- MSWDO successfully created 4Ps announcement? ${annCreatedSuccess ? '✅ YES (ID: ' + createdAnnId + ')' : '❌ NO'}`);

  // Check announcement visibility: DSWD Admin vs MSWDO
  const dswdAnnList = await makeRequest('GET', '/api/announcements', null, dswdAdminToken);
  const mswdoAnnList = await makeRequest('GET', '/api/announcements', null, mswdoAdminToken);

  const dswdSeesMswdoAnn = Array.isArray(dswdAnnList.body?.data) && dswdAnnList.body.data.some(a => a.id === createdAnnId);
  const mswdoSeesMswdoAnn = Array.isArray(mswdoAnnList.body?.data) && mswdoAnnList.body.data.some(a => a.id === createdAnnId);

  console.log(`- DSWD Admin sees MSWDO announcement? ${dswdSeesMswdoAnn ? '❌ LEAKED TO DSWD' : '✅ NO (Isolated from DSWD)'}`);
  console.log(`- MSWDO sees own MSWDO announcement? ${mswdoSeesMswdoAnn ? '✅ YES (Visible to MSWDO)' : '❌ NO'}`);

  // ── CLEANUP ──
  console.log('\nCleaning up test program and announcement...');
  if (createdProgId) {
    await BenefitProgram.destroy({ where: { id: createdProgId } });
  }
  if (createdAnnId) {
    await Notification.destroy({ where: { reference_id: createdAnnId } });
    await Announcement.destroy({ where: { id: createdAnnId } });
  }
  console.log('Cleanup finished.');

  const allPassed = mswdoBlocked && dswdAllowed && progCreatedSuccess && !dswdSeesMswdoProg && mswdoSeesMswdoProg && annCreatedSuccess && !dswdSeesMswdoAnn && mswdoSeesMswdoAnn;

  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Payout verification, programs separation with 4Ps, and announcements separation are 100% verified!');
  } else {
    console.log('\n⚠️ Some checks failed. Please review the output above.');
  }

  process.exit(allPassed ? 0 : 1);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
