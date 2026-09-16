const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
  console.log('=== VERIFYING MSWDO 4PS BENEFICIARY LIST ACCESS ===');

  const mswdoToken = jwt.sign({ id: 4217, role: 'mswdo_admin' }, JWT_SECRET, { expiresIn: '1h' });

  // 1. GET /api/beneficiaries
  console.log('\n1. MSWDO fetching GET /api/beneficiaries...');
  const resList = await makeRequest('GET', '/api/beneficiaries', null, mswdoToken);
  console.log('Status:', resList.status);
  const beneficiaries = resList.body?.data || [];
  console.log('Total beneficiaries returned for MSWDO:', beneficiaries.length);

  const fourPsList = beneficiaries.filter(b => (b.category || '').toLowerCase().includes('4ps'));
  const seniorList = beneficiaries.filter(b => (b.category || '').toLowerCase().includes('senior'));
  const pwdList = beneficiaries.filter(b => (b.category || '').toLowerCase().includes('pwd') || (b.category || '').toLowerCase().includes('disabilit'));

  console.log(`- 4Ps Beneficiaries count: ${fourPsList.length} ${fourPsList.length > 0 ? '✅' : '❌'}`);
  console.log(`- Senior Citizens count: ${seniorList.length} ${seniorList.length > 0 ? '✅' : '❌'}`);
  console.log(`- PWD Beneficiaries count: ${pwdList.length} ${pwdList.length > 0 ? '✅' : '❌'}`);

  fourPsList.forEach(b => {
    console.log(`  → 4Ps: [ID: ${b.id}] ${b.first_name} ${b.last_name} (${b.category})`);
  });

  // 2. GET /api/beneficiaries/:id for a 4Ps beneficiary
  if (fourPsList.length > 0) {
    const test4PsId = fourPsList[0].id;
    console.log(`\n2. MSWDO fetching details for 4Ps beneficiary ID ${test4PsId} (${fourPsList[0].first_name} ${fourPsList[0].last_name})...`);
    const resSingle = await makeRequest('GET', `/api/beneficiaries/${test4PsId}`, null, mswdoToken);
    console.log(`- Single view status: ${resSingle.status} ${resSingle.status === 200 ? '✅ (200 OK)' : '❌'}`);
  }

  // 3. GET /api/reports/summary for MSWDO
  console.log('\n3. MSWDO fetching GET /api/reports/summary...');
  const resDash = await makeRequest('GET', '/api/reports/summary', null, mswdoToken);
  console.log('Status:', resDash.status);
  const summary = resDash.body?.data || resDash.body || {};
  console.log(`- Dashboard totalBeneficiaries: ${summary.totalBeneficiaries} ${summary.totalBeneficiaries >= 7 ? '✅' : '❌'}`);
  console.log(`- Dashboard fourPsCount: ${summary.fourPsCount} ${summary.fourPsCount >= 4 ? '✅' : '❌'}`);
  console.log(`- Dashboard seniorCitizensCount: ${summary.seniorCitizensCount}`);
  console.log(`- Dashboard pwdCount: ${summary.pwdCount}`);

  if (fourPsList.length >= 4 && resList.status === 200 && summary.fourPsCount >= 4) {
    console.log('\n🎉 ALL MSWDO 4PS BENEFICIARY LIST TESTS PASSED PERFECTLY!');
  } else {
    console.log('\n⚠️ SOME CHECKS FAILED. Please review above.');
  }

  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
