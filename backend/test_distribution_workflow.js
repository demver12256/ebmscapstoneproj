/**
 * Distribution Workflow Testing Script
 * 
 * This script tests the complete distribution workflow:
 * 1. Admin creates a distribution event
 * 2. Admin publishes the event (validates budget, creates transactions)
 * 3. Staff starts distribution session
 * 4. Staff verifies and releases benefits
 * 5. Staff ends distribution session
 * 6. Generates receipts
 * 
 * Prerequisites:
 * - Backend server running on http://localhost:5000
 * - Valid admin and staff user accounts
 * - At least one benefit program and barangay configured
 * - Approved beneficiaries enrolled in the program
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test configuration
const config = {
  adminToken: '', // Add admin JWT token here
  staffToken: '', // Add staff JWT token here
  programId: 1, // Change to valid program ID
  barangayId: 1, // Change to valid barangay ID
  staffId: 2, // Change to valid staff ID assigned to the barangay
};

// Helper function to make authenticated requests
const api = {
  admin: axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${config.adminToken}` },
  }),
  staff: axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${config.staffToken}` },
  }),
};

// Test results
const results = {
  passed: [],
  failed: [],
  eventId: null,
  transactionId: null,
};

// Helper to log test results
function logTest(name, passed, details = '') {
  if (passed) {
    results.passed.push(name);
    console.log(`✅ ${name}`);
    if (details) console.log(`   ${details}`);
  } else {
    results.failed.push(name);
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
  console.log('');
}

// Test functions
async function test1_CreateDraftEvent() {
  console.log('🧪 Test 1: Create Distribution Event (Draft)');
  try {
    const response = await api.admin.post('/distributions/events', {
      title: `Test Distribution - ${new Date().toISOString()}`,
      program_id: config.programId,
      barangay_id: config.barangayId,
      distribution_date: '2026-03-15',
      venue: 'Test Venue - Barangay Hall',
      budget: 100000,
      amount_per_beneficiary: 1000,
      assigned_staff_id: config.staffId,
      notes: 'Automated test event',
    });

    results.eventId = response.data.data.id;
    logTest(
      'Create Draft Event',
      response.data.success && response.data.data.status === 'draft',
      `Event ID: ${results.eventId}`
    );
    return true;
  } catch (error) {
    logTest('Create Draft Event', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test2_PreviewEligibleBeneficiaries() {
  console.log('🧪 Test 2: Preview Eligible Beneficiaries');
  try {
    const response = await api.admin.get(
      `/distributions/events/${results.eventId}/eligible-beneficiaries`,
      {
        params: {
          program_id: config.programId,
          barangay_id: config.barangayId,
        },
      }
    );

    const beneficiaryCount = response.data.data.length;
    logTest(
      'Preview Eligible Beneficiaries',
      response.data.success && beneficiaryCount > 0,
      `Found ${beneficiaryCount} eligible beneficiaries`
    );
    return beneficiaryCount > 0;
  } catch (error) {
    logTest(
      'Preview Eligible Beneficiaries',
      false,
      error.response?.data?.message || error.message
    );
    return false;
  }
}

async function test3_PublishEvent() {
  console.log('🧪 Test 3: Publish Distribution Event');
  try {
    const response = await api.admin.post(
      `/distributions/events/${results.eventId}/publish`
    );

    logTest(
      'Publish Event',
      response.data.success && response.data.data.status === 'scheduled',
      `${response.data.summary?.total_beneficiaries || 0} beneficiaries enrolled`
    );
    return true;
  } catch (error) {
    logTest('Publish Event', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test4_ViewEventDetails() {
  console.log('🧪 Test 4: View Event Details with Statistics');
  try {
    const response = await api.admin.get(`/distributions/events/${results.eventId}`);

    const hasStats = response.data.data.stats && 
                     typeof response.data.data.stats.total_beneficiaries === 'number';

    logTest(
      'View Event Details',
      response.data.success && hasStats,
      `Total: ${response.data.data.stats?.total_beneficiaries || 0}, Released: ${response.data.data.stats?.total_released || 0}`
    );
    return true;
  } catch (error) {
    logTest('View Event Details', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test5_StaffViewsEvents() {
  console.log('🧪 Test 5: Staff Views Assigned Events (Barangay Filter)');
  try {
    const response = await api.staff.get('/distributions/events', {
      params: { status: 'scheduled' },
    });

    const hasEvent = response.data.data.some(e => e.id === results.eventId);
    logTest(
      'Staff Views Events',
      response.data.success && hasEvent,
      `Staff can see ${response.data.data.length} event(s) in their barangay`
    );
    return true;
  } catch (error) {
    logTest('Staff Views Events', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test6_StartDistributionSession() {
  console.log('🧪 Test 6: Start Distribution Session');
  try {
    const response = await api.staff.post(
      `/distributions/events/${results.eventId}/start-session`
    );

    logTest(
      'Start Distribution Session',
      response.data.success && response.data.data.status === 'ongoing',
      'Session started successfully'
    );
    return true;
  } catch (error) {
    logTest(
      'Start Distribution Session',
      false,
      error.response?.data?.message || error.message
    );
    return false;
  }
}

async function test7_GetTransactions() {
  console.log('🧪 Test 7: Get Transactions List');
  try {
    const response = await api.staff.get(
      `/distributions/events/${results.eventId}/transactions`
    );

    const pendingTxn = response.data.data.find(t => t.status === 'pending');
    if (pendingTxn) {
      results.transactionId = pendingTxn.id;
    }

    logTest(
      'Get Transactions List',
      response.data.success && response.data.data.length > 0,
      `Found ${response.data.data.length} transaction(s), Selected TXN ID: ${results.transactionId}`
    );
    return pendingTxn !== undefined;
  } catch (error) {
    logTest('Get Transactions List', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test8_VerifyTransaction() {
  console.log('🧪 Test 8: Verify Transaction');
  try {
    const response = await api.staff.post(
      `/distributions/events/${results.eventId}/transactions/${results.transactionId}/verify`
    );

    const allChecksValid = Object.values(response.data.checks).every(check => check === true);

    logTest(
      'Verify Transaction',
      response.data.success && response.data.verified === true,
      `Verification: ${response.data.verified ? 'PASSED' : 'FAILED'} - All checks: ${allChecksValid}`
    );
    return response.data.verified;
  } catch (error) {
    logTest('Verify Transaction', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test9_ReleaseBenefit() {
  console.log('🧪 Test 9: Release Benefit');
  try {
    const response = await api.staff.post(
      `/distributions/events/${results.eventId}/transactions/${results.transactionId}/release`,
      {
        signature_data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        verification_method: 'manual',
        notes: 'Automated test release',
      }
    );

    logTest(
      'Release Benefit',
      response.data.success && response.data.data.status === 'released',
      `Transaction ${response.data.data.transaction_number} released successfully`
    );
    return true;
  } catch (error) {
    logTest('Release Benefit', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test10_PreventDuplicateRelease() {
  console.log('🧪 Test 10: Prevent Duplicate Release');
  try {
    await api.staff.post(
      `/distributions/events/${results.eventId}/transactions/${results.transactionId}/release`,
      {
        signature_data: 'data:image/png;base64,test',
        verification_method: 'manual',
      }
    );

    logTest('Prevent Duplicate Release', false, 'Should have been blocked but succeeded');
    return false;
  } catch (error) {
    const blocked = error.response?.data?.error_code === 'ALREADY_RELEASED';
    logTest(
      'Prevent Duplicate Release',
      blocked,
      blocked ? 'Correctly prevented duplicate release' : 'Wrong error'
    );
    return blocked;
  }
}

async function test11_GenerateReceipt() {
  console.log('🧪 Test 11: Generate Receipt');
  try {
    const response = await api.staff.get(
      `/distributions/events/${results.eventId}/receipt/${results.transactionId}`
    );

    const hasRequiredFields = 
      response.data.data.transaction_number &&
      response.data.data.beneficiary_name &&
      response.data.data.amount &&
      response.data.data.formatted_amount &&
      response.data.data.amount_in_words;

    logTest(
      'Generate Receipt',
      response.data.success && hasRequiredFields,
      `Receipt for ${response.data.data.beneficiary_name} - ${response.data.data.formatted_amount}`
    );
    return true;
  } catch (error) {
    logTest('Generate Receipt', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test12_DashboardStatistics() {
  console.log('🧪 Test 12: Dashboard Statistics');
  try {
    const response = await api.admin.get('/distributions/dashboard/stats');

    const hasStats = 
      response.data.data.events &&
      response.data.data.transactions &&
      typeof response.data.data.transactions.release_percentage === 'number';

    logTest(
      'Dashboard Statistics',
      response.data.success && hasStats,
      `Total Events: ${response.data.data.events.total}, Release Rate: ${response.data.data.transactions.release_percentage}%`
    );
    return true;
  } catch (error) {
    logTest('Dashboard Statistics', false, error.response?.data?.message || error.message);
    return false;
  }
}

async function test13_EndDistributionSession() {
  console.log('🧪 Test 13: End Distribution Session');
  try {
    const response = await api.staff.post(
      `/distributions/events/${results.eventId}/end-session`
    );

    logTest(
      'End Distribution Session',
      response.data.success,
      `Final Status: ${response.data.data.status}, Released: ${response.data.summary?.released || 0}`
    );
    return true;
  } catch (error) {
    logTest(
      'End Distribution Session',
      false,
      error.response?.data?.message || error.message
    );
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 DISTRIBUTION WORKFLOW TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Validate configuration
  if (!config.adminToken || !config.staffToken) {
    console.log('❌ Error: Admin and Staff tokens are required!');
    console.log('   Please update the config object with valid JWT tokens.\n');
    return;
  }

  const tests = [
    test1_CreateDraftEvent,
    test2_PreviewEligibleBeneficiaries,
    test3_PublishEvent,
    test4_ViewEventDetails,
    test5_StaffViewsEvents,
    test6_StartDistributionSession,
    test7_GetTransactions,
    test8_VerifyTransaction,
    test9_ReleaseBenefit,
    test10_PreventDuplicateRelease,
    test11_GenerateReceipt,
    test12_DashboardStatistics,
    test13_EndDistributionSession,
  ];

  for (const test of tests) {
    const success = await test();
    if (!success && test !== test10_PreventDuplicateRelease) {
      console.log('⚠️  Test failed, stopping test suite.\n');
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between tests
  }

  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📈 Success Rate: ${((results.passed.length / tests.length) * 100).toFixed(1)}%`);
  
  if (results.eventId) {
    console.log(`\n🎯 Test Event ID: ${results.eventId}`);
    console.log(`   You can view this event at: ${BASE_URL}/distributions/events/${results.eventId}`);
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');

  if (results.failed.length === 0) {
    console.log('🎉 All tests passed! Distribution workflow is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test suite crashed:', error.message);
  process.exit(1);
});
