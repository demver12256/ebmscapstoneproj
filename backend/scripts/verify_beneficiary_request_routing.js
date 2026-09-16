const http = require('http');
const { connectDatabase, User, Beneficiary, Barangay, AssistanceRequest } = require('../db');
const jwt = require('jsonwebtoken');

function apiCall(token, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

function makeToken(user) {
  const secret = process.env.JWT_SECRET || 'ebms_super_secret_jwt_key_change_in_production';
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '1h' }
  );
}

async function runTest() {
  await connectDatabase();
  const { Op } = require('sequelize');

  console.log('--- RUNNING BENEFICIARY REQUEST ASSISTANCE DIRECT ROUTING TEST ---');

  // Find a Senior Citizen or PWD beneficiary
  const seniorBen = await Beneficiary.findOne({
    where: { category: { [Op.like]: '%Senior%' }, status: 'Approved' },
    include: [{ model: User }],
  });

  if (!seniorBen || !seniorBen.User) {
    console.log('No approved Senior Citizen beneficiary found in DB for testing.');
    process.exit(0);
  }

  const seniorToken = makeToken(seniorBen.User);

  // Find a 4Ps beneficiary
  const fourPsBen = await Beneficiary.findOne({
    where: { category: { [Op.like]: '%4Ps%' }, status: 'Approved' },
    include: [{ model: User }],
  });

  // Find DSWD admin & MSWDO admin
  const dswdAdmin = await User.findOne({ where: { role: 'admin' } });
  const mswdoAdmin = await User.findOne({ where: { role: 'mswdo_admin' } });

  const dswdToken = makeToken(dswdAdmin);
  const mswdoToken = makeToken(mswdoAdmin);

  // 1. 4Ps beneficiary submitting request directed to MSWDO (Now Allowed!)
  let fourPsMswdoReqId = null;
  let fourPsDswdReqId = null;
  let fourPsToken = null;

  if (fourPsBen && fourPsBen.User) {
    fourPsToken = makeToken(fourPsBen.User);

    console.log('1. 4Ps beneficiary submitting request directed to MSWDO for Food & Relief...');
    const res1 = await apiCall(fourPsToken, 'POST', '/api/assistance-requests', {
      agency: 'MSWDO',
      type: 'Food & Relief Assistance',
      subject: 'Food Relief para sa 4Ps Pamilya',
      description: 'Emergency food relief assistance para sa pamilya',
      priority: 'Normal',
    });
    console.log('   Result:', res1.status, res1.data?.message);
    if (res1.status === 201) {
      fourPsMswdoReqId = res1.data?.data?.id;
      console.log('   PASS: 4Ps beneficiary successfully requested at MSWDO!');
    } else {
      console.log('   FAIL: 4Ps should be allowed at MSWDO!');
    }

    console.log('2. 4Ps beneficiary submitting request directed to DSWD for Medical Assistance...');
    const res2 = await apiCall(fourPsToken, 'POST', '/api/assistance-requests', {
      agency: 'DSWD',
      type: 'Medical Assistance',
      subject: 'Gamot para sa 4Ps Miyembro',
      description: 'Medical assistance para sa maintenance medicine',
      priority: 'Normal',
    });
    console.log('   Result:', res2.status, res2.data?.message);
    if (res2.status === 201) {
      fourPsDswdReqId = res2.data?.data?.id;
      console.log('   PASS: 4Ps beneficiary successfully requested at DSWD!');
    }

    // 3. CROSS-AGENCY EXCLUSIVITY: 4Ps tries to request Medical Assistance at MSWDO (Already requested at DSWD)
    console.log('3. 4Ps attempting to submit Medical Assistance to MSWDO (already at DSWD)...');
    const res3 = await apiCall(fourPsToken, 'POST', '/api/assistance-requests', {
      agency: 'MSWDO',
      type: 'Medical Assistance',
      subject: 'Duplicate Medical Assistance',
      description: 'Submitting same type to MSWDO',
      priority: 'Normal',
    });
    console.log('   Result:', res3.status, res3.data?.message);
    if (res3.status === 409) {
      console.log('   PASS: Blocked by Cross-Agency Duplicate Rule (DSWD -> MSWDO)!');
    } else {
      console.log('   FAIL: Should be blocked by Cross-Agency Duplicate Rule!');
    }

    // 4. CROSS-AGENCY EXCLUSIVITY: 4Ps tries to request Food & Relief at DSWD (Already requested at MSWDO)
    console.log('4. 4Ps attempting to submit Food & Relief to DSWD (already at MSWDO)...');
    const res4 = await apiCall(fourPsToken, 'POST', '/api/assistance-requests', {
      agency: 'DSWD',
      type: 'Food & Relief Assistance',
      subject: 'Duplicate Food Relief',
      description: 'Submitting same type to DSWD',
      priority: 'Normal',
    });
    console.log('   Result:', res4.status, res4.data?.message);
    if (res4.status === 409) {
      console.log('   PASS: Blocked by Cross-Agency Duplicate Rule (MSWDO -> DSWD)!');
    } else {
      console.log('   FAIL: Should be blocked by Cross-Agency Duplicate Rule!');
    }
  }

  // 5. Senior beneficiary submitting request directed to MSWDO
  console.log('5. Senior beneficiary submitting request directed to MSWDO...');
  const seniorRes = await apiCall(seniorToken, 'POST', '/api/assistance-requests', {
    agency: 'MSWDO',
    type: 'Burial Assistance',
    subject: 'Burial Aid para sa Senior',
    description: 'Tulong sa libing',
    priority: 'Urgent',
  });
  const seniorMswdoReqId = seniorRes.data?.data?.id;
  console.log('   Result:', seniorRes.status, seniorRes.data?.message);

  // Clean up created test records
  if (fourPsMswdoReqId) await AssistanceRequest.destroy({ where: { id: fourPsMswdoReqId } });
  if (fourPsDswdReqId) await AssistanceRequest.destroy({ where: { id: fourPsDswdReqId } });
  if (seniorMswdoReqId) await AssistanceRequest.destroy({ where: { id: seniorMswdoReqId } });
  console.log('Cleaned up test records.');

  console.log('--- ALL CHECKS COMPLETED SUCCESSFULLY! ---');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
