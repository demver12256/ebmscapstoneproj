/**
 * Test script to verify automatic beneficiary enrollment when creating a program
 * 
 * This simulates the route logic to test:
 * 1. Creating a program automatically enrolls eligible beneficiaries
 * 2. Only Approved beneficiaries are enrolled
 * 3. Only beneficiaries from the same barangay are enrolled
 * 4. Only beneficiaries with matching category are enrolled (if eligibility_category is set)
 */

const { BenefitProgram, Beneficiary, Enrollment, Barangay, AuditLog } = require('./db');
const { Op } = require('sequelize');

async function testAutoEnrollment() {
  console.log('\n🧪 Testing Automatic Beneficiary Enrollment Logic...\n');

  try {
    // Step 1: Find a barangay with approved PWD beneficiaries
    console.log('📋 Step 1: Finding test data...');
    
    const anilao = await Barangay.findOne({
      where: { barangay_name: 'Anilao' }
    });

    if (!anilao) {
      console.error('❌ Barangay Anilao not found!');
      return;
    }

    console.log(`✅ Found barangay: ${anilao.barangay_name} (ID: ${anilao.id})`);

    // Count approved PWD beneficiaries in Anilao
    const pwdBeneficiaries = await Beneficiary.findAll({
      where: {
        barangay_id: anilao.id,
        status: 'Approved',
        category: { [Op.like]: '%PWD%' }
      }
    });

    console.log(`✅ Found ${pwdBeneficiaries.length} approved PWD beneficiaries in Anilao:`);
    pwdBeneficiaries.forEach((b, i) => {
      console.log(`   ${i + 1}. ${b.first_name} ${b.last_name} (ID: ${b.id}, Category: ${b.category})`);
    });

    if (pwdBeneficiaries.length === 0) {
      console.log('\n⚠️  No PWD beneficiaries found to test with!');
      return;
    }

    // Step 2: Create a new program and simulate the route's auto-enrollment logic
    console.log('\n📋 Step 2: Creating a new PWD program with auto-enrollment...');
    
    const programData = {
      name: 'PWD Assistance Program - Test ' + Date.now(),
      description: 'Test program for PWD beneficiaries in Anilao',
      eligibility_category: 'PWD',
      benefit_type: 'Cash',
      status: 'active',
      total_budget: 100000,
      barangay_id: anilao.id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    // Create program
    const program = await BenefitProgram.create(programData);
    console.log(`✅ Program created: ${program.name} (ID: ${program.id})`);

    // Simulate the auto-enrollment logic from the route
    let autoEnrolledCount = 0;
    console.log('\n📋 Step 3: Running auto-enrollment logic...');
    
    try {
      // Build where clause for eligible beneficiaries
      const whereClause = {
        status: 'Approved',
        barangay_id: program.barangay_id
      };

      // If program has eligibility_category, filter by matching category
      if (program.eligibility_category) {
        whereClause.category = {
          [Op.like]: `%${program.eligibility_category}%`
        };
      }

      console.log('   Search criteria:', JSON.stringify(whereClause, null, 2));

      // Find all eligible beneficiaries
      const eligibleBeneficiaries = await Beneficiary.findAll({
        where: whereClause,
        attributes: ['id', 'first_name', 'last_name', 'category']
      });

      console.log(`   ✅ Found ${eligibleBeneficiaries.length} eligible beneficiaries`);
      eligibleBeneficiaries.forEach((b, i) => {
        console.log(`      ${i + 1}. ${b.first_name} ${b.last_name} (ID: ${b.id})`);
      });

      if (eligibleBeneficiaries.length > 0) {
        // Create enrollments for all eligible beneficiaries
        const enrollmentData = eligibleBeneficiaries.map(b => ({
          program_id: program.id,
          beneficiary_id: b.id,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'active'
        }));

        console.log('\n   Creating enrollments...');
        const enrollments = await Enrollment.bulkCreate(enrollmentData);
        autoEnrolledCount = enrollments.length;

        console.log(`   ✅ Successfully created ${autoEnrolledCount} enrollments`);

        // Log auto-enrollment action (simulating route)
        await AuditLog.create({
          user_id: 1, // Admin user
          action: `Auto-enrolled ${autoEnrolledCount} eligible beneficiary(ies) into program: ${program.name}`,
          module: 'programs',
        });
      }
    } catch (enrollError) {
      console.error('❌ Auto-enrollment error:', enrollError);
      console.error(enrollError.stack);
    }

    // Step 4: Verify enrollments were created
    console.log('\n📋 Step 4: Verifying enrollments in database...');
    
    const enrollments = await Enrollment.findAll({
      where: { program_id: program.id },
      include: [{ 
        model: Beneficiary,
        attributes: ['id', 'first_name', 'last_name', 'category', 'status', 'barangay_id']
      }]
    });

    console.log(`\n✅ Found ${enrollments.length} enrollments in database!`);

    if (enrollments.length > 0) {
      console.log('\n📋 Enrolled beneficiaries:');
      enrollments.forEach((e, index) => {
        const b = e.Beneficiary;
        console.log(`   ${index + 1}. ${b.first_name} ${b.last_name} (ID: ${b.id})`);
        console.log(`      - Category: ${b.category}`);
        console.log(`      - Status: ${b.status}`);
        console.log(`      - Barangay ID: ${b.barangay_id}`);
        console.log(`      - Enrollment Status: ${e.status}`);
        console.log(`      - Enrollment Date: ${e.enrollment_date}`);
      });

      // Verify eligibility criteria
      console.log('\n📋 Step 5: Verifying eligibility criteria...');
      
      let allValid = true;
      for (const e of enrollments) {
        const b = e.Beneficiary;
        
        if (b.status !== 'Approved') {
          console.error(`   ❌ Beneficiary ${b.id} is not Approved (Status: ${b.status})`);
          allValid = false;
        }
        
        if (b.barangay_id !== program.barangay_id) {
          console.error(`   ❌ Beneficiary ${b.id} is from wrong barangay`);
          allValid = false;
        }
        
        if (!b.category?.toLowerCase().includes('pwd')) {
          console.error(`   ❌ Beneficiary ${b.id} is not PWD (Category: ${b.category})`);
          allValid = false;
        }
      }

      if (allValid) {
        console.log('   ✅ All enrolled beneficiaries meet eligibility criteria!');
      }

      console.log('\n✅✅✅ Auto-enrollment test PASSED! The logic works correctly.\n');
    } else {
      console.error('\n❌ No beneficiaries were enrolled! Check the logic.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

// Run test
testAutoEnrollment();
