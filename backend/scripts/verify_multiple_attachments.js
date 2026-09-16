const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { connectDatabase, User, Beneficiary, AssistanceRequest } = require('../db');

function makeToken(user) {
  const secret = process.env.JWT_SECRET || 'ebms_super_secret_jwt_key_change_in_production';
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: '1h' }
  );
}

async function runMultiAttachmentTest() {
  await connectDatabase();
  console.log('--- TESTING MULTI-FILE ATTACHMENT IN ASSISTANCE REQUESTS ---');

  const beneficiary = await Beneficiary.findOne({
    where: { status: 'Approved' },
    include: [{ model: User }],
  });

  if (!beneficiary || !beneficiary.User) {
    console.log('No approved beneficiary found for testing.');
    process.exit(0);
  }

  const token = makeToken(beneficiary.User);

  // Construct multipart/form-data boundary
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);

  const file1Content = Buffer.from('PDF Prescription Test Content');
  const file2Content = Buffer.from('JPEG Valid ID Test Content');

  const fields = [
    { name: 'agency', value: 'DSWD' },
    { name: 'type', value: 'Medicines Assistance' },
    { name: 'subject', value: 'Test Multiple Attachments Submission' },
    { name: 'description', value: 'Kasama ang reseta at valid ID para sa pagsusuri.' },
    { name: 'priority', value: 'Normal' },
  ];

  const payloadChunks = [];

  // Add text fields
  for (const f of fields) {
    payloadChunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`
    ));
  }

  // Add File 1 (Prescription)
  payloadChunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="Prescription_Dr_Santos.pdf"\r\nContent-Type: application/pdf\r\n\r\n`
  ));
  payloadChunks.push(file1Content);
  payloadChunks.push(Buffer.from('\r\n'));

  // Add File 2 (Valid ID)
  payloadChunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="Senior_Citizen_ID.png"\r\nContent-Type: image/png\r\n\r\n`
  ));
  payloadChunks.push(file2Content);
  payloadChunks.push(Buffer.from('\r\n'));

  // End boundary
  payloadChunks.push(Buffer.from(`--${boundary}--\r\n`));

  const finalBody = Buffer.concat(payloadChunks);

  const postPromise = new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/assistance-requests',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': finalBody.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(finalBody);
    req.end();
  });

  const res = await postPromise;
  console.log('Submission status:', res.status);
  console.log('Submission message:', res.data?.message);

  if (res.status !== 201) {
    console.error('FAILED to create request with multiple attachments:', res);
    process.exit(1);
  }

  const createdId = res.data?.data?.id;
  const createdRecord = await AssistanceRequest.findByPk(createdId);
  console.log('\nStored attachment_url in DB:');
  console.log(createdRecord.attachment_url);

  let parsed = null;
  try {
    parsed = JSON.parse(createdRecord.attachment_url);
  } catch (e) {}

  if (Array.isArray(parsed) && parsed.length === 2) {
    console.log('✅ PASS: Successfully stored 2 files in attachment_url JSON array!');
    console.log('  File 1:', parsed[0].name, '->', parsed[0].url);
    console.log('  File 2:', parsed[1].name, '->', parsed[1].url);
  } else {
    console.error('❌ FAIL: Expected 2 files in JSON array, got:', parsed);
    process.exit(1);
  }

  // Cleanup
  await AssistanceRequest.destroy({ where: { id: createdId } });
  console.log('Cleaned up test record.');
  console.log('--- TEST PASSED WITH FLYING COLORS! ---');
  process.exit(0);
}

runMultiAttachmentTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
