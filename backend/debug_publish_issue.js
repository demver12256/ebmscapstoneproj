require('dotenv').config();
const { 
  DistributionEvent, 
  BenefitProgram, 
  Enrollment, 
  Beneficiary,
  Barangay,
  sequelize 
} = require('./db');

async function debugPublishIssue() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Get the event that's failing
    const eventId = 109; // Update this to your event ID
    
    const event = await DistributionEvent.findByPk(eventId, {
      include: [
        { model: BenefitProgram, as: 'Program' },
        { model: Barangay }
      ]
    });

    if (!event) {
      console.log('❌ Event not found!');
      process.exit(1);
    }

    console.log('📋 EVENT DETAILS:');
    console.log('─────────────────────────────────────');
    console.log('ID:', event.id);
    console.log('Title:', event.title);
    console.log('Status:', event.status);
    console.log('Program:', event.Program?.name, `(ID: ${event.program_id})`);
    console.log('Barangay:', event.Barangay?.barangay_name, `(ID: ${event.barangay_id})`);
    console.log('Target Category:', event.target_category || 'None');
    console.log('Program Eligibility Category:', event.Program?.eligibility_category || 'None');
    console.log('Budget:', event.budget);
    console.log('Amount per Beneficiary:', event.amount_per_beneficiary);
    console.log('Assigned Staff ID:', event.assigned_staff_id);
    console.log('');

    // Check enrollments for this program
    console.log('📝 ENROLLMENTS IN THIS PROGRAM:');
    console.log('─────────────────────────────────────');
    const allEnrollments = await Enrollment.findAll({
      where: { program_id: event.program_id },
      include: [{ 
        model: Beneficiary,
        include: [{ model: Barangay }]
      }]
    });

    console.log(`Total enrollments in program: ${allEnrollments.length}`);
    
    if (allEnrollments.length === 0) {
      console.log('❌ NO ENROLLMENTS FOUND IN THIS PROGRAM!');
      console.log('   You need to enroll beneficiaries first.');
    } else {
      allEnrollments.forEach((e, i) => {
        console.log(`\n${i + 1}. ${e.Beneficiary.first_name} ${e.Beneficiary.last_name}`);
        console.log(`   Status: ${e.status}`);
        console.log(`   Beneficiary Status: ${e.Beneficiary.status}`);
        console.log(`   Category: ${e.Beneficiary.category}`);
        console.log(`   Barangay: ${e.Beneficiary.Barangay?.barangay_name} (ID: ${e.Beneficiary.barangay_id})`);
      });
    }
    console.log('');

    // Filter by barangay
    console.log('🏘️  ENROLLMENTS IN TARGET BARANGAY:');
    console.log('─────────────────────────────────────');
    const barangayEnrollments = allEnrollments.filter(
      e => e.Beneficiary.barangay_id === event.barangay_id
    );
    console.log(`Enrollments in barangay ${event.barangay_id}: ${barangayEnrollments.length}`);
    
    if (barangayEnrollments.length === 0) {
      console.log('❌ NO ENROLLMENTS IN THIS BARANGAY!');
      console.log(`   Event requires barangay_id: ${event.barangay_id} (${event.Barangay?.barangay_name})`);
      console.log('   But enrollments are in other barangays.');
    }
    console.log('');

    // Filter by status = Approved
    console.log('✅ APPROVED BENEFICIARIES IN BARANGAY:');
    console.log('─────────────────────────────────────');
    const approvedEnrollments = barangayEnrollments.filter(
      e => e.Beneficiary.status === 'Approved'
    );
    console.log(`Approved beneficiaries: ${approvedEnrollments.length}`);
    
    if (approvedEnrollments.length === 0) {
      console.log('❌ NO APPROVED BENEFICIARIES!');
      console.log('   Beneficiaries must have status = "Approved"');
      barangayEnrollments.forEach(e => {
        console.log(`   - ${e.Beneficiary.first_name} ${e.Beneficiary.last_name}: ${e.Beneficiary.status}`);
      });
    }
    console.log('');

    // Filter by enrollment status = active
    console.log('🔄 ACTIVE ENROLLMENTS:');
    console.log('─────────────────────────────────────');
    const activeEnrollments = approvedEnrollments.filter(
      e => e.status === 'active'
    );
    console.log(`Active enrollments: ${activeEnrollments.length}`);
    
    if (activeEnrollments.length === 0) {
      console.log('❌ NO ACTIVE ENROLLMENTS!');
      console.log('   Enrollments must have status = "active"');
      approvedEnrollments.forEach(e => {
        console.log(`   - ${e.Beneficiary.first_name} ${e.Beneficiary.last_name}: enrollment status = ${e.status}`);
      });
    }
    console.log('');

    // Filter by category if specified
    if (event.target_category || event.Program?.eligibility_category) {
      console.log('🏷️  CATEGORY FILTER:');
      console.log('─────────────────────────────────────');
      const categoryFilter = event.target_category || event.Program.eligibility_category;
      console.log(`Required category contains: "${categoryFilter}"`);
      
      const categoryMatch = activeEnrollments.filter(e => 
        e.Beneficiary.category && e.Beneficiary.category.includes(categoryFilter)
      );
      
      console.log(`Beneficiaries matching category: ${categoryMatch.length}`);
      
      if (categoryMatch.length === 0) {
        console.log('❌ NO BENEFICIARIES MATCH CATEGORY!');
        activeEnrollments.forEach(e => {
          console.log(`   - ${e.Beneficiary.first_name} ${e.Beneficiary.last_name}: category = "${e.Beneficiary.category}"`);
        });
      } else {
        console.log('✅ ELIGIBLE BENEFICIARIES:');
        categoryMatch.forEach(e => {
          console.log(`   ✓ ${e.Beneficiary.first_name} ${e.Beneficiary.last_name} (${e.Beneficiary.category})`);
        });
      }
    } else {
      console.log('ℹ️  No category filter applied');
      if (activeEnrollments.length > 0) {
        console.log('✅ ELIGIBLE BENEFICIARIES:');
        activeEnrollments.forEach(e => {
          console.log(`   ✓ ${e.Beneficiary.first_name} ${e.Beneficiary.last_name}`);
        });
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY:');
    console.log('═'.repeat(60));
    
    if (allEnrollments.length === 0) {
      console.log('❌ PROBLEM: No beneficiaries enrolled in this program');
      console.log('   SOLUTION: Go to Program List → View program → Enroll beneficiaries');
    } else if (barangayEnrollments.length === 0) {
      console.log(`❌ PROBLEM: No enrollments in barangay "${event.Barangay?.barangay_name}"`);
      console.log('   SOLUTION: Enroll beneficiaries from this barangay, or change event barangay');
    } else if (approvedEnrollments.length === 0) {
      console.log('❌ PROBLEM: Enrolled beneficiaries are not Approved');
      console.log('   SOLUTION: Go to Beneficiary Applications → Approve beneficiaries');
    } else if (activeEnrollments.length === 0) {
      console.log('❌ PROBLEM: Enrollments are not active');
      console.log('   SOLUTION: Check enrollment status in database');
    } else {
      const categoryFilter = event.target_category || event.Program?.eligibility_category;
      if (categoryFilter) {
        console.log(`❌ PROBLEM: No beneficiaries match category "${categoryFilter}"`);
        console.log('   SOLUTION: Either remove category filter or enroll matching beneficiaries');
      } else {
        console.log('✅ Should work! Check backend logs for exact query error');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugPublishIssue();
