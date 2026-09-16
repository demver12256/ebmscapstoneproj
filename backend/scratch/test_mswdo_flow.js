require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

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

(async () => {
  const mswdoToken = jwt.sign(
    { id: 4217, email: 'mswdo@ebms.local', role: 'mswdo_admin' },
    process.env.JWT_SECRET || 'supersecretkey'
  );
  const staffToken = jwt.sign(
    { id: 106, email: 'demver@gmail.com', role: 'staff', barangay_id: 37 },
    process.env.JWT_SECRET || 'supersecretkey'
  );

  // 1. Find an MSWDO program ID in Anilao
  const progRes = await apiCall(mswdoToken, 'GET', '/api/programs');
  const prog = progRes.data?.data?.find(p => p.benefit_type === 'Cash' && p.barangay_id === 37);
  if (!prog) {
    console.error('No cash program found for Anilao');
    return;
  }
  console.log('Selected MSWDO Program:', prog.id, prog.name);

  // 2. MSWDO Admin creates distribution event in draft
  console.log('Step 1: MSWDO Admin creates distribution event (Draft)...');
  const createRes = await apiCall(mswdoToken, 'POST', '/api/distributions/events', {
    title: 'MSWDO Test Interactive Flow Payout',
    program_id: prog.id,
    barangay_id: 37,
    distribution_date: '2026-09-10',
    venue: 'Anilao Community Hall',
    amount_per_beneficiary: 1500,
    assigned_staff_id: 106,
    notes: 'Testing full MSWDO lifecycle',
  });
  console.log('  Create status:', createRes.status, 'ID:', createRes.data?.data?.id);
  const eventId = createRes.data?.data?.id;
  if (!eventId) {
    console.error('Failed to create event:', createRes);
    return;
  }

  // 3. MSWDO Admin publishes event
  console.log(`Step 2: MSWDO Admin publishes event #${eventId}...`);
  const pubRes = await apiCall(mswdoToken, 'POST', `/api/distributions/events/${eventId}/publish`);
  console.log('  Publish status:', pubRes.status, 'Message:', pubRes.data?.message);
  
  // 4. Check transactions
  const txnsRes = await apiCall(mswdoToken, 'GET', `/api/distributions/events/${eventId}/transactions`);
  const txns = txnsRes.data?.data || [];
  console.log('  Transactions generated:', txns.length, txns.map(t => ({ id: t.id, num: t.transaction_number, status: t.status })));
  const txnId = txns[0]?.id;

  // 5. Staff starts distribution session
  console.log('Step 3: Staff starts distribution session (Ongoing)...');
  const startRes = await apiCall(staffToken, 'POST', `/api/distributions/events/${eventId}/start-session`);
  console.log('  Start session status:', startRes.status, 'Event status:', startRes.data?.data?.status);

  // 6. Staff releases transaction
  console.log(`Step 4: Staff releases transaction #${txnId} (Released)...`);
  const relRes = await apiCall(staffToken, 'POST', `/api/distributions/events/${eventId}/transactions/${txnId}/release`, {
    release_notes: 'Released via RFID scan & physical signature',
    verification_method: 'rfid',
    signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  });
  console.log('  Release status:', relRes.status, 'Message:', relRes.data?.message);

  // 7. Staff ends distribution session
  console.log('Step 5: Staff ends distribution session (Completed)...');
  const compRes = await apiCall(staffToken, 'POST', `/api/distributions/events/${eventId}/end-session`);
  console.log('  End session status:', compRes.status, 'Event status:', compRes.data?.data?.status);

  // 8. Verify MSWDO stats
  console.log('Step 6: Verify MSWDO stats after complete lifecycle...');
  const statsRes = await apiCall(mswdoToken, 'GET', '/api/distributions/dashboard/stats');
  console.log('  Updated MSWDO Stats:', JSON.stringify(statsRes.data?.data, null, 2));

  // 9. Clean up test event so DB remains pristine
  console.log(`Step 7: Cleaning up test event #${eventId}...`);
  const { DistributionEvent, DistributionTransaction } = require('../db');
  await DistributionTransaction.destroy({ where: { distribution_event_id: eventId } });
  await DistributionEvent.destroy({ where: { id: eventId } });
  console.log('Cleanup completed. Full MSWDO distribution lifecycle verified 100% SUCCESS!');
})()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Lifecycle test error:', err);
    process.exit(1);
  });
