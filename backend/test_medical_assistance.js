const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING MEDICAL ASSISTANCE TESTS ---');

  // 1. Admin login
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ebms.local', password: 'Admin@123' }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.token) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginData));
  }
  const adminToken = loginData.token;
  console.log('✅ Admin login successful');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  };

  // 2. Fetch admin applications
  const adminAppsRes = await fetch(`${API_BASE}/medical-assistance/admin/applications`, {
    headers: authHeaders,
  });
  const adminAppsData = await adminAppsRes.json();
  if (!adminAppsData.success) {
    console.error('adminAppsData error:', adminAppsData);
    throw new Error('Failed to get admin applications: ' + JSON.stringify(adminAppsData));
  }
  console.log(`✅ Admin fetched applications: ${adminAppsData.data.length} records found`);

  // Check stats
  const statsRes = await fetch(`${API_BASE}/medical-assistance/admin/stats`, {
    headers: authHeaders,
  });
  const statsData = await statsRes.json();
  console.log('✅ Admin stats response:', statsData.data);

  // 3. Test requirements matrix dynamic logic
  // Case A: Medicines with Immediate Family
  const reqARes = await fetch(`${API_BASE}/medical-assistance/requirements-matrix`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'Medicines Assistance',
      applicant_relationship: 'Son',
      pharmacy_name: 'Oriental 21 Pharmacy',
    }),
  });
  const reqA = await reqARes.json();
  const codesA = reqA.data.map(d => d.code);
  console.log('Case A (Medicines, Son):', codesA);
  if (!codesA.includes('valid_id') || !codesA.includes('medical_certificate') || !codesA.includes('prescription') || !codesA.includes('price_quotation')) {
    throw new Error('Case A missing mandatory codes');
  }

  // Case B: Medicines with Non-Immediate Family (Common-Law Partner)
  const reqBRes = await fetch(`${API_BASE}/medical-assistance/requirements-matrix`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'Medicines Assistance',
      applicant_relationship: 'Common-Law Partner',
    }),
  });
  const reqB = await reqBRes.json();
  const codesB = reqB.data.map(d => d.code);
  console.log('Case B (Medicines, Non-Immediate):', codesB);
  if (!codesB.includes('rep_valid_id') || !codesB.includes('rep_patient_id') || !codesB.includes('rep_auth_letter') || !codesB.includes('rep_brgy_cert')) {
    throw new Error('Case B missing non-immediate mandatory validation codes');
  }

  // Case C: Hospital Bill - Currently Confined
  const reqCRes = await fetch(`${API_BASE}/medical-assistance/requirements-matrix`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'Hospital Bill Assistance',
      applicant_relationship: 'Mother',
      hospital_confinement_status: 'currently_confined',
    }),
  });
  const reqC = await reqCRes.json();
  const codesC = reqC.data.map(d => d.code);
  console.log('Case C (Hospital Bill, Confined):', codesC);
  if (!codesC.includes('hospital_up_to_present')) {
    throw new Error('Case C missing hospital_up_to_present code');
  }

  // Case D: Hospital Bill - Discharged with Balance + Surgery
  const reqDRes = await fetch(`${API_BASE}/medical-assistance/requirements-matrix`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'Hospital Bill Assistance',
      applicant_relationship: 'Father',
      hospital_confinement_status: 'discharged_with_balance',
      had_surgical_operation: true,
    }),
  });
  const reqD = await reqDRes.json();
  const codesD = reqD.data.map(d => d.code);
  console.log('Case D (Hospital Bill, Discharged + Surgery):', codesD);
  if (!codesD.includes('clinical_abstract') || !codesD.includes('promissory_note') || !codesD.includes('certificate_of_balance') || !codesD.includes('final_hospital_bill')) {
    throw new Error('Case D missing surgical or discharge balance codes');
  }

  // 4. Test document review & status transition on seeded application
  const targetApp = adminAppsData.data[0];
  console.log(`Testing admin review on App ID ${targetApp.id} (${targetApp.application_number})`);

  // Move to Under Verification
  const updateRes = await fetch(`${API_BASE}/medical-assistance/admin/applications/${targetApp.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'Under Verification',
      staff_remarks: 'Testing verification workflow - documents confirmed.',
    }),
  });
  const updateData = await updateRes.json();
  if (!updateData.success) {
    console.error('Update status error:', updateData);
    throw new Error('Update failed: ' + JSON.stringify(updateData));
  }
  console.log('✅ Updated status to Under Verification:', updateData.data.status);

  // If app has documents, test document approval
  if (targetApp.Documents && targetApp.Documents.length > 0) {
    const docId = targetApp.Documents[0].id;
    const docRevRes = await fetch(`${API_BASE}/medical-assistance/admin/documents/${docId}/review`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'Approved',
        remarks: 'Validated against hospital directory.',
      }),
    });
    const docRevData = await docRevRes.json();
    console.log(`✅ Document ${docId} reviewed:`, docRevData.data.status);
  }

  console.log('🎉 ALL BACKEND API & VALIDATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
