/**
 * Test Script: Program Enrollment Workflow
 * 
 * This script tests the complete workflow:
 * 1. Create a Program (no auto-enrollment)
 * 2. Enroll Beneficiaries explicitly
 * 3. Create Distribution Event
 * 4. Verify distribution uses only enrolled beneficiaries
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let authToken = '';

// Admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@ebms.local',
  password: 'Admin@123'
};

// Helper function to make API calls
const api = {
  post: (url, data) => axios.post(`${API_URL}${url}`, data, {
    headers: { Authorization: `Bearer ${authToken}` }
  }),
  get: (url) => axios.get(`${API_URL}${url}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  }),
  put: (url, data) => axios.put(`${API_URL}${url}`, data, {
    headers: { Authorization: `Bearer ${authToken}` }
  }),
};

async function login() {
  console.log('🔐 Logging in as Admin...');
  const response = await axios.post(`${API_URL}/auth/login`, ADMIN_CREDENTIALS);
  authToken = response.data.token;
  console.log('✅ Login successful!\n');
}

async function testWorkflow() {
  try {
    await login();

    // ─────────────────────────────────────────────────
    // TEST 1: Create Program (No Auto-Enrollment)
    // ─────────────────────────────────────────────────
    console.log('📋 TEST 1: Create Program (No Auto-Enrollment)');
    console.log('━'.repeat(60));
    
    const programData = {
      name: 'Medical Assistance Test',
      description: 'Test medical assistance program',
      eligibility_category: 'Senior Citizens (Social Pension)',
      barangay_id: 1, // Anilao Proper
      total_budget: 50000,
      allocated_budget: 50000,
      start_date: '2024-02-01',
      end_date: '2024-12-31',
      status: 'active'
    };

    const createResponse = await api.post('/programs', programData);
    const programId = createResponse.data.data.id;
    console.log(`✅ Program created: ID ${programId} - ${createResponse.data.data.name}`);

    // Check that NO enrollments were created
    const enrolledResponse = await api.get(`/programs/${programId}/beneficiaries`);
    const enrolledCount = enrolledResponse.data.data.length;
    console.log(`✅ Enrolled beneficiaries: ${enrolledCount}`);
    
    if (enrolledCount === 0) {
      console.log('✅ PASS: No auto-enrollment occurred\n');
    } else {
      console.log('❌ FAIL: Auto-enrollment occurred unexpectedly!\n');
      return;
    }

    // ─────────────────────────────────────────────────
    // TEST 2: Get Eligible Beneficiaries
    // ─────────────────────────────────────────────────
    console.log('👥 TEST 2: Get Eligible Beneficiaries');
    console.log('━'.repeat(60));

    // Get all approved beneficiaries
    const beneficiariesResponse = await api.get('/beneficiaries');
    const allBeneficiaries = beneficiariesResponse.data.data;
    
    // Filter eligible beneficiaries manually (same logic as frontend)
    const eligible = allBeneficiaries.filter(b => {
      if (b.status !== 'Approved') return false;
      if (b.barangay_id !== programData.barangay_id) return false;
      if (programData.eligibility_category) {
        if (!b.category || !b.category.includes(programData.eligibility_category)) {
          return false;
        }
      }
      return true;
    });

    console.log(`✅ Total beneficiaries in system: ${allBeneficiaries.length}`);
    console.log(`✅ Approved beneficiaries: ${allBeneficiaries.filter(b => b.status === 'Approved').length}`);
    console.log(`✅ Eligible for this program: ${eligible.length}`);
    
    if (eligible.length > 0) {
      console.log(`✅ Sample eligible beneficiary: ${eligible[0].first_name} ${eligible[0].last_name} (${eligible[0].category})\n`);
    } else {
      console.log('❌ No eligible beneficiaries found. Please ensure there are approved Senior Citizens in Barangay 1.\n');
      return;
    }

    // ─────────────────────────────────────────────────
    // TEST 3: Enroll Beneficiaries
    // ─────────────────────────────────────────────────
    console.log('➕ TEST 3: Enroll Beneficiaries');
    console.log('━'.repeat(60));

    // Select first 3 eligible beneficiaries
    const toEnroll = eligible.slice(0, 3).map(b => b.id);
    console.log(`Enrolling ${toEnroll.length} beneficiaries: ${toEnroll.join(', ')}`);

    const enrollResponse = await api.post(`/programs/${programId}/enroll`, {
      beneficiary_ids: toEnroll
    });

    console.log(`✅ ${enrollResponse.data.message}`);
    console.log(`✅ Enrolled count: ${enrollResponse.data.data.enrolled_count}`);
    console.log(`✅ Already enrolled: ${enrollResponse.data.data.already_enrolled_count}\n`);

    // Verify enrollments
    const verifyEnrolled = await api.get(`/programs/${programId}/beneficiaries`);
    const finalEnrolled = verifyEnrolled.data.data;
    console.log(`✅ Verified enrolled beneficiaries: ${finalEnrolled.length}`);
    finalEnrolled.forEach(b => {
      console.log(`   - ${b.first_name} ${b.last_name} (${b.category})`);
    });
    console.log('');

    // ─────────────────────────────────────────────────
    // TEST 4: Prevent Duplicate Enrollment
    // ─────────────────────────────────────────────────
    console.log('🚫 TEST 4: Prevent Duplicate Enrollment');
    console.log('━'.repeat(60));

    try {
      await api.post(`/programs/${programId}/enroll`, {
        beneficiary_ids: toEnroll // Try to enroll same beneficiaries again
      });
      console.log('❌ FAIL: Duplicate enrollment was allowed!\n');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log(`✅ PASS: Duplicate enrollment prevented`);
        console.log(`✅ Error message: ${error.response.data.message}\n`);
      } else {
        throw error;
      }
    }

    // ─────────────────────────────────────────────────
    // TEST 5: Create Distribution Event
    // ─────────────────────────────────────────────────
    console.log('📦 TEST 5: Create Distribution Event');
    console.log('━'.repeat(60));

    const distributionData = {
      title: 'Test Distribution Event',
      description: 'Testing enrollment workflow',
      program_id: programId,
      barangay_id: programData.barangay_id,
      distribution_date: '2024-02-15',
      venue: 'Barangay Hall',
      budget: 10000,
      amount_per_beneficiary: 1000,
      assigned_staff_id: 2, // Assuming staff user ID 2 exists
      target_category: null // Use program's eligibility_category
    };

    const createDistResponse = await api.post('/distributions/events', distributionData);
    const eventId = createDistResponse.data.data.id;
    console.log(`✅ Distribution event created: ID ${eventId}`);
    console.log(`✅ Status: ${createDistResponse.data.data.status}\n`);

    // ─────────────────────────────────────────────────
    // TEST 6: Check Eligible Count (Draft)
    // ─────────────────────────────────────────────────
    console.log('🔢 TEST 6: Check Eligible Count (Draft)');
    console.log('━'.repeat(60));

    const countResponse = await api.get(`/distributions/events/${eventId}/count-eligible`);
    const countData = countResponse.data.data;
    
    console.log(`✅ Eligible count: ${countData.eligible_count}`);
    console.log(`✅ Amount per beneficiary: ₱${countData.amount_per_beneficiary}`);
    console.log(`✅ Total required: ₱${countData.total_required}`);
    console.log(`✅ Available budget: ₱${countData.available_budget}`);
    console.log(`✅ Budget sufficient: ${countData.budget_sufficient}`);

    if (countData.eligible_count === finalEnrolled.length) {
      console.log(`✅ PASS: Eligible count matches enrolled count (${finalEnrolled.length})\n`);
    } else {
      console.log(`❌ FAIL: Eligible count (${countData.eligible_count}) does not match enrolled count (${finalEnrolled.length})\n`);
      return;
    }

    // ─────────────────────────────────────────────────
    // TEST 7: Publish Distribution Event
    // ─────────────────────────────────────────────────
    console.log('🚀 TEST 7: Publish Distribution Event');
    console.log('━'.repeat(60));

    const publishResponse = await api.post(`/distributions/events/${eventId}/publish`);
    console.log(`✅ ${publishResponse.data.message}`);
    console.log(`✅ Status: ${publishResponse.data.data.status}`);
    console.log(`✅ Total beneficiaries: ${publishResponse.data.summary.total_beneficiaries}`);
    console.log(`✅ Total budget allocated: ₱${publishResponse.data.summary.total_budget_allocated}\n`);

    // ─────────────────────────────────────────────────
    // TEST 8: Verify Transactions Created
    // ─────────────────────────────────────────────────
    console.log('📝 TEST 8: Verify Transactions Created');
    console.log('━'.repeat(60));

    const transactionsResponse = await api.get(`/distributions/events/${eventId}/transactions`);
    const transactions = transactionsResponse.data.data;

    console.log(`✅ Transactions created: ${transactions.length}`);
    
    if (transactions.length === finalEnrolled.length) {
      console.log(`✅ PASS: Transaction count matches enrolled count\n`);
    } else {
      console.log(`❌ FAIL: Transaction count (${transactions.length}) does not match enrolled count (${finalEnrolled.length})\n`);
      return;
    }

    // Verify each enrolled beneficiary has a transaction
    const txnBeneficiaryIds = transactions.map(t => t.beneficiary_id);
    const enrolledBeneficiaryIds = finalEnrolled.map(b => b.id);
    
    console.log('Verifying each enrolled beneficiary has a transaction:');
    let allMatched = true;
    for (const enrolledId of enrolledBeneficiaryIds) {
      if (txnBeneficiaryIds.includes(enrolledId)) {
        const beneficiary = finalEnrolled.find(b => b.id === enrolledId);
        console.log(`   ✅ ${beneficiary.first_name} ${beneficiary.last_name} - Transaction created`);
      } else {
        console.log(`   ❌ Beneficiary ID ${enrolledId} - NO TRANSACTION`);
        allMatched = false;
      }
    }

    if (allMatched) {
      console.log('\n✅ PASS: All enrolled beneficiaries have transactions\n');
    } else {
      console.log('\n❌ FAIL: Some enrolled beneficiaries are missing transactions\n');
      return;
    }

    // ─────────────────────────────────────────────────
    // TEST 9: Add New Beneficiary Later
    // ─────────────────────────────────────────────────
    console.log('➕ TEST 9: Add New Beneficiary Later');
    console.log('━'.repeat(60));

    if (eligible.length > 3) {
      const newBeneficiary = [eligible[3].id]; // 4th eligible beneficiary
      console.log(`Enrolling additional beneficiary: ${eligible[3].first_name} ${eligible[3].last_name}`);

      const addResponse = await api.post(`/programs/${programId}/enroll`, {
        beneficiary_ids: newBeneficiary
      });

      console.log(`✅ ${addResponse.data.message}`);

      const updatedEnrolled = await api.get(`/programs/${programId}/beneficiaries`);
      console.log(`✅ Total enrolled now: ${updatedEnrolled.data.data.length}\n`);
    } else {
      console.log('⚠️  Skipped: Not enough eligible beneficiaries\n');
    }

    // ─────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────
    console.log('═'.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('═'.repeat(60));
    console.log('✅ Program created without auto-enrollment');
    console.log('✅ Beneficiaries enrolled explicitly');
    console.log('✅ Duplicate enrollments prevented');
    console.log('✅ Distribution uses only enrolled beneficiaries');
    console.log('✅ Transactions created for enrolled beneficiaries only');
    console.log('✅ New beneficiaries can be added later');
    console.log('═'.repeat(60));
    console.log('\n✨ Program → Enrollment → Distribution workflow is working correctly!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testWorkflow();
