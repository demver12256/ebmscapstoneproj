require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');
const { connectDatabase, User, Beneficiary, BenefitProgram, DistributionEvent, AssistanceRequest, Announcement, Attendance } = require('../db');

const apiCall = (token, method, path, body = null) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

async function runVerification() {
  console.log('================================================================');
  console.log('  MSWDO ADMIN ISOLATION VERIFICATION SUITE');
  console.log('================================================================\n');

  await connectDatabase();

  // Find or setup MSWDO Admin user
  let mswdoUser = await User.findOne({ where: { role: 'mswdo_admin' } });
  if (!mswdoUser) {
    mswdoUser = await User.create({
      first_name: 'MSWDO',
      last_name: 'Officer',
      email: 'mswdo_test@ebms.local',
      password: 'password123',
      role: 'mswdo_admin',
      status: 'active'
    });
    console.log('Created test mswdo_admin user ID:', mswdoUser.id);
  }

  // Find or setup DSWD Admin user
  let dswdUser = await User.findOne({ where: { role: 'admin' } });
  if (!dswdUser) {
    dswdUser = await User.create({
      first_name: 'DSWD',
      last_name: 'Admin',
      email: 'dswd_test@ebms.local',
      password: 'password123',
      role: 'admin',
      status: 'active'
    });
    console.log('Created test admin user ID:', dswdUser.id);
  }

  const mswdoToken = jwt.sign(
    { id: mswdoUser.id, email: mswdoUser.email, role: mswdoUser.role },
    process.env.JWT_SECRET || 'supersecretkey'
  );

  const dswdToken = jwt.sign(
    { id: dswdUser.id, email: dswdUser.email, role: dswdUser.role },
    process.env.JWT_SECRET || 'supersecretkey'
  );

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Beneficiary List Isolation (4Ps Excluded for MSWDO)
  // -------------------------------------------------------------
  console.log('TEST 1: Beneficiary Category Filtering');
  const benRes = await apiCall(mswdoToken, 'GET', '/api/beneficiaries');
  assert(benRes.status === 200, 'MSWDO can fetch beneficiaries list');
  const mswdoBens = benRes.data?.data || [];
  const fourPsInMswdo = mswdoBens.filter(b => (b.category || '').toLowerCase().includes('4ps') || (b.category || '').toLowerCase().includes('pantawid'));
  assert(fourPsInMswdo.length === 0, `MSWDO sees 0 4Ps beneficiaries (found ${fourPsInMswdo.length} out of ${mswdoBens.length} total)`);

  const dswdBenRes = await apiCall(dswdToken, 'GET', '/api/beneficiaries');
  const dswdBens = dswdBenRes.data?.data || [];
  const fourPsInDswd = dswdBens.filter(b => (b.category || '').toLowerCase().includes('4ps') || (b.category || '').toLowerCase().includes('pantawid'));
  console.log(`  (DSWD Admin sees ${fourPsInDswd.length} 4Ps beneficiaries out of ${dswdBens.length} total)`);

  // -------------------------------------------------------------
  // TEST 2: Beneficiary Attendance Endpoint Isolation
  // -------------------------------------------------------------
  console.log('\nTEST 2: Beneficiary Attendance Endpoint Isolation');
  const fourPsBen = await Beneficiary.findOne({
    where: { category: '4Ps Household Beneficiaries' }
  });

  if (fourPsBen) {
    const attRes = await apiCall(mswdoToken, 'GET', `/api/beneficiaries/${fourPsBen.id}/attendance`);
    assert(attRes.status === 403, `MSWDO is blocked (HTTP 403) from viewing attendance of 4Ps beneficiary #${fourPsBen.id}`);
  } else {
    console.log('  [SKIP] No 4Ps beneficiary in DB to test attendance block');
  }

  const seniorOrPwdBen = await Beneficiary.findOne({
    where: { category: 'Senior Citizen' }
  }) || await Beneficiary.findOne({
    where: { category: 'Persons with Disabilities (PWD)' }
  });

  if (seniorOrPwdBen) {
    const attResSenior = await apiCall(mswdoToken, 'GET', `/api/beneficiaries/${seniorOrPwdBen.id}/attendance`);
    assert(attResSenior.status === 200, `MSWDO can view attendance for Senior/PWD beneficiary #${seniorOrPwdBen.id}`);
    const attData = attResSenior.data?.data;
    // Check meetings: all returned meetings must be created by MSWDO user
    const otherMeetings = (attData?.allMeetings || []).filter(m => m.created_by_user_id !== mswdoUser.id);
    assert(otherMeetings.length === 0, `All returned attendance meetings belong strictly to MSWDO user (found ${otherMeetings.length} other meetings)`);
  }

  // -------------------------------------------------------------
  // TEST 3: Benefit Program Beneficiaries Access
  // -------------------------------------------------------------
  console.log('\nTEST 3: Program Beneficiaries Access Scoping');
  const dswdProg = await BenefitProgram.findOne({ where: { agency: 'DSWD' } });
  if (dswdProg) {
    const progBenRes = await apiCall(mswdoToken, 'GET', `/api/programs/${dswdProg.id}/beneficiaries`);
    assert(progBenRes.status === 403, `MSWDO is blocked (HTTP 403) from viewing beneficiaries of DSWD program #${dswdProg.id}`);

    const dswdProgBenRes = await apiCall(dswdToken, 'GET', `/api/programs/${dswdProg.id}/beneficiaries`);
    assert(dswdProgBenRes.status === 200, `DSWD Admin can view beneficiaries of DSWD program #${dswdProg.id}`);
  } else {
    console.log('  [SKIP] No DSWD program found in DB');
  }

  // -------------------------------------------------------------
  // TEST 4: Distribution Event Transactions & Actions Access
  // -------------------------------------------------------------
  console.log('\nTEST 4: Distribution Events Scoping');
  const dswdEvent = await DistributionEvent.findOne({ where: { agency: 'DSWD' } });
  if (dswdEvent) {
    const txnRes = await apiCall(mswdoToken, 'GET', `/api/distributions/events/${dswdEvent.id}/transactions`);
    assert(txnRes.status === 403, `MSWDO is blocked (HTTP 403) from transactions of DSWD event #${dswdEvent.id}`);

    const eligRes = await apiCall(mswdoToken, 'GET', `/api/distributions/events/${dswdEvent.id}/eligible-beneficiaries`);
    assert(eligRes.status === 403, `MSWDO is blocked (HTTP 403) from eligible beneficiaries of DSWD event #${dswdEvent.id}`);

    const disburseRes = await apiCall(mswdoToken, 'POST', `/api/distributions/events/${dswdEvent.id}/disburse-digital`);
    assert(disburseRes.status === 403, `MSWDO is blocked (HTTP 403) from disbursing DSWD event #${dswdEvent.id}`);
  } else {
    console.log('  [SKIP] No DSWD distribution event found in DB');
  }

  // -------------------------------------------------------------
  // TEST 5: Medical Assistance (AICS) Scoping
  // -------------------------------------------------------------
  console.log('\nTEST 5: Medical Assistance (AICS) Isolation');
  const medAppsRes = await apiCall(mswdoToken, 'GET', '/api/medical-assistance/admin/applications');
  assert(medAppsRes.status === 200 && Array.isArray(medAppsRes.data?.data) && medAppsRes.data?.data.length === 0, 'MSWDO receives empty list for DSWD Medical Assistance applications');

  const medStatsRes = await apiCall(mswdoToken, 'GET', '/api/medical-assistance/admin/stats');
  assert(medStatsRes.status === 200 && medStatsRes.data?.data?.statusCounts?.total === 0, 'MSWDO receives 0 total for DSWD Medical Assistance stats');

  // -------------------------------------------------------------
  // TEST 6: Assistance Requests Isolation & Creation
  // -------------------------------------------------------------
  console.log('\nTEST 6: Assistance Requests Isolation & Role Validation');
  const reqListRes = await apiCall(mswdoToken, 'GET', '/api/assistance-requests');
  assert(reqListRes.status === 200, 'MSWDO can query assistance requests');
  const reqList = reqListRes.data?.data || [];
  const foreignRequests = reqList.filter(r => r.user_id !== mswdoUser.id && r.reviewed_by !== mswdoUser.id);
  assert(foreignRequests.length === 0, `MSWDO only sees requests they created or reviewed (foreign: ${foreignRequests.length})`);

  if (fourPsBen) {
    const create4PsRes = await apiCall(mswdoToken, 'POST', '/api/assistance-requests', {
      beneficiary_id: fourPsBen.id,
      type: 'Financial Assistance',
      subject: 'Unauthorized 4Ps Request',
      description: 'Should fail with 403',
    });
    assert(create4PsRes.status === 403, 'MSWDO is blocked (HTTP 403) from creating assistance request for 4Ps beneficiary');
  }

  if (seniorOrPwdBen) {
    const createSeniorRes = await apiCall(mswdoToken, 'POST', '/api/assistance-requests', {
      beneficiary_id: seniorOrPwdBen.id,
      type: 'Medical Assistance',
      subject: 'Senior Citizen Medicine Support',
      description: 'Monthly prescription subsidy for hypertension',
      priority: 'Normal',
    });
    assert(createSeniorRes.status === 201, 'MSWDO successfully creates assistance request for Senior/PWD beneficiary');
    const createdReqId = createSeniorRes.data?.data?.id;

    if (createdReqId) {
      // Update status as MSWDO
      const updateRes = await apiCall(mswdoToken, 'PATCH', `/api/assistance-requests/${createdReqId}/status`, {
        status: 'Approved',
        admin_notes: 'Approved by MSWDO Officer',
      });
      assert(updateRes.status === 200, `MSWDO can update status of their created assistance request #${createdReqId}`);

      // Clean up test request
      await AssistanceRequest.destroy({ where: { id: createdReqId } });
    }
  }

  // -------------------------------------------------------------
  // TEST 7: Reports Summary Scoping (fourPsCount === 0)
  // -------------------------------------------------------------
  console.log('\nTEST 7: Reports Summary Scoping');
  const reportRes = await apiCall(mswdoToken, 'GET', '/api/reports/summary');
  assert(reportRes.status === 200, 'MSWDO can fetch reports summary');
  const repData = reportRes.data?.data;
  assert(repData?.fourPsCount === 0, `MSWDO summary report reports fourPsCount = 0 (received: ${repData?.fourPsCount})`);

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
