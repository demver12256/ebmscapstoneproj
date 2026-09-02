require('dotenv').config({ path: __dirname + '/.env' });
const fetch = globalThis.fetch || require('node-fetch');

async function testTwoTierApproval() {
  console.log('--- TESTING TWO-TIER BARANGAY VERIFICATION & ADMIN APPROVAL ---');

  // 1. Admin login
  const adminRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ebms.local', password: 'Admin@123' }),
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.token;
  console.log('✅ Admin login OK');

  // Find or create a barangay staff user for testing
  const { User, MedicalAssistanceApplication, Barangay } = require('./db');
  const bcrypt = require('bcrypt');

  const testBarangay = await Barangay.findOne();
  if (!testBarangay) {
    console.error('No barangay found');
    process.exit(1);
  }

  let brgyStaff = await User.findOne({ where: { role: 'barangay', barangay_id: testBarangay.id } });
  if (!brgyStaff) {
    brgyStaff = await User.create({
      username: 'brgystaff_test',
      email: 'brgystaff@ebms.local',
      password: 'Password@123',
      first_name: 'Barangay',
      last_name: 'Officer',
      role: 'barangay',
      status: 'active',
      barangay_id: testBarangay.id,
    });
  } else {
    brgyStaff.password = 'Password@123';
    await brgyStaff.save();
  }
  console.log(`✅ Barangay Staff user ready: ${brgyStaff.username} (Barangay ID: ${testBarangay.id})`);

  // Login as Barangay Staff
  const brgyRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: brgyStaff.email, password: 'Password@123' }),
  });
  const brgyData = await brgyRes.json();
  const brgyToken = brgyData.token;
  if (!brgyToken) {
    console.error('Barangay staff login failed:', brgyData);
    process.exit(1);
  }
  console.log('✅ Barangay Staff login OK');

  const { Beneficiary } = require('./db');
  const ben = await Beneficiary.findOne();
  if (!ben) {
    console.error('No beneficiary found');
    process.exit(1);
  }

  // Create a draft / pending test application
  const testApp = await MedicalAssistanceApplication.create({
    application_number: `TEST-TT-${Date.now()}`,
    user_id: brgyStaff.id,
    beneficiary_id: ben.id,
    barangay_id: testBarangay.id,
    category: 'Medical Assistance',
    applicant_relationship: 'Self',
    patient_name: 'Test Two Tier Patient',
    status: 'Pending Review',
    total_amount_requested: 12500.00,
  });
  console.log(`✅ Created test application: ${testApp.application_number} (ID: ${testApp.id})`);

  // 2. Test Rule: Barangay Staff tries to APPROVE directly -> SHOULD BE FORBIDDEN (403)
  console.log('\n🔍 Testing Rule 1: Can Barangay Staff give final Approval?');
  const directApproveRes = await fetch(`http://localhost:5000/api/medical-assistance/admin/applications/${testApp.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${brgyToken}`,
    },
    body: JSON.stringify({
      status: 'Approved',
      approved_amount: 10000,
    }),
  });
  const directApproveData = await directApproveRes.json();
  console.log(`Response Status: ${directApproveRes.status}`);
  console.log('Response Message:', directApproveData.message);

  if (directApproveRes.status === 403) {
    console.log('🛡️ PASS: Barangay Staff was correctly blocked from final approval!');
  } else {
    console.error('❌ FAIL: Barangay Staff should NOT be able to approve directly!');
    process.exit(1);
  }

  // 3. Test Rule: Barangay Staff verifies & endorses to Admin
  console.log('\n🔍 Testing Rule 2: Barangay Staff verifies & endorses to Admin');
  const endorseRes = await fetch(`http://localhost:5000/api/medical-assistance/admin/applications/${testApp.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${brgyToken}`,
    },
    body: JSON.stringify({
      status: 'Verified by Barangay',
      staff_remarks: 'All requirements verified complete by Barangay Staff.',
      barangay_endorsement_notes: 'Confirmed bona fide resident. Ready for Admin final approval.',
    }),
  });
  const endorseData = await endorseRes.json();
  if (!endorseData.success) {
    console.error('❌ Endorse failed:', endorseData);
    process.exit(1);
  }
  console.log(`✅ PASS: Application successfully endorsed to Admin. Status is now: ${endorseData.data?.status}`);

  // 4. Test Rule: Admin performs FINAL APPROVAL
  console.log('\n🔍 Testing Rule 3: Admin performs Final Approval');
  const adminApproveRes = await fetch(`http://localhost:5000/api/medical-assistance/admin/applications/${testApp.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      status: 'Approved',
      approved_amount: 12000.00,
      assistance_type_granted: 'DSWD Guarantee Letter (GL)',
      staff_remarks: 'Final Admin review approved. Guarantee Letter issued.',
    }),
  });
  const adminApproveData = await adminApproveRes.json();
  if (!adminApproveData.success) {
    console.error('❌ Admin approve failed:', adminApproveData);
    process.exit(1);
  }
  console.log(`🎉 PASS: Final Approval granted by Admin! Approved Amount: ₱${adminApproveData.data?.approved_amount}`);

  // Clean up test app
  await testApp.destroy();
  console.log('🧹 Cleaned up test application.');
  console.log('\n🏆 ALL TWO-TIER HIERARCHY TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testTwoTierApproval().catch(err => {
  console.error(err);
  process.exit(1);
});
