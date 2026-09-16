const path = require('path');
const { sequelize, Beneficiary, DistributionEvent, DistributionTransaction, User } = require('../backend/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

async function testApiFlow() {
  try {
    console.log('--- Testing Hybrid Digital Payout API Endpoints ---');

    // 1. Get an admin user for JWT auth
    const adminUser = await User.findOne({ where: { role: 'admin' } });
    if (!adminUser) {
      console.log('No admin user found.');
      process.exit(1);
    }
    const token = jwt.sign(
      { id: adminUser.id, role: adminUser.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '1h' }
    );

    const http = require('http');

    function makeRequest(options, postData = null) {
      return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ status: res.statusCode, body: data });
            }
          });
        });
        req.on('error', reject);
        if (postData) {
          req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
      });
    }

    // 2. Test verify-payout-account endpoint
    const ben = await Beneficiary.findOne();
    console.log(`\n1. Testing Account Verification for Beneficiary #${ben.id}:`);

    // Test with matching name
    const verifyRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/beneficiaries/${ben.id}/verify-payout-account`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, { force: false });

    console.log('Verify response status:', verifyRes.status);
    console.log('Verify response body:', verifyRes.body);

    // 3. Find or create a test event for digital payout
    console.log('\n2. Testing Digital Payout Summary for an event:');
    let event = await DistributionEvent.findOne({
      where: { status: ['scheduled', 'ongoing'] },
      include: [{ model: DistributionTransaction, as: 'Transactions' }]
    });

    if (!event) {
      event = await DistributionEvent.findOne({
        include: [{ model: DistributionTransaction, as: 'Transactions' }]
      });
    }

    if (event) {
      // Temporarily mark one transaction as 'digital' and 'pending' to test disburse-digital
      const txn = await DistributionTransaction.findOne({
        where: { distribution_event_id: event.id }
      });

      if (txn) {
        await txn.update({
          disbursement_type: 'digital',
          status: 'pending',
          payout_provider: 'GCash'
        });
        console.log(`Set transaction #${txn.id} to digital (pending, GCash) for testing.`);
      }

      // Check summary
      const summaryRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/distributions/events/${event.id}/payout-summary`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Summary response status:', summaryRes.status);
      console.log('Summary response data:', summaryRes.body?.data);

      // 4. Test disburse-digital
      console.log('\n3. Testing POST /events/:id/disburse-digital:');
      const disburseRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/distributions/events/${event.id}/disburse-digital`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, {});
      console.log('Disburse response status:', disburseRes.status);
      console.log('Disburse response body:', disburseRes.body);

      // Check transaction updated
      if (txn) {
        await txn.reload();
        console.log(`Updated transaction #${txn.id} status: ${txn.status}, ref: ${txn.payout_reference_number}`);
      }
    }

    console.log('\n--- ALL API TESTS COMPLETED ---');
    process.exit(0);
  } catch (err) {
    console.error('API Test error:', err);
    process.exit(1);
  }
}

testApiFlow();
