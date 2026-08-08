require('dotenv').config();
const { 
  BenefitProgram, 
  Enrollment, 
  Beneficiary,
  Barangay,
  sequelize 
} = require('./db');

async function enrollBeneficiariesToProgram() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const programId = 196; // Regular Cash Grant
    const barangayId = 37; // Anilao
    const targetCategory = '4Ps';

    console.log('📋 Finding program...');
    const program = await BenefitProgram.findByPk(programId);
    
    if (!program) {
      console.log('❌ Program not found!');
      process.exit(1);
    }

    console.log(`Program: ${program.name}`);
    console.log(`Eligibility: ${program.eligibility_category}`);
    console.log('');

    console.log('🔍 Finding eligible beneficiaries...');
    console.log(`   - Barangay ID: ${barangayId} (Anilao)`);
    console.log(`   - Category: Contains "${targetCategory}"`);
    console.log(`   - Status: Approved`);
    console.log('');

    // Find approved beneficiaries in Anilao with 4Ps category
    const beneficiaries = await Beneficiary.findAll({
      where: {
        barangay_id: barangayId,
        status: 'Approved'
      },
      include: [{ model: Barangay }]
    });

    console.log(`Found ${beneficiaries.length} approved beneficiaries in Anilao`);
    
    // Filter by category
    const eligibleBeneficiaries = beneficiaries.filter(b => 
      b.category && b.category.includes(targetCategory)
    );

    console.log(`   ${eligibleBeneficiaries.length} match category "${targetCategory}"`);
    console.log('');

    if (eligibleBeneficiaries.length === 0) {
      console.log('❌ No eligible beneficiaries found!');
      console.log('\nAll beneficiaries in Anilao:');
      beneficiaries.forEach(b => {
        console.log(`   - ${b.first_name} ${b.last_name}: category = "${b.category}", status = ${b.status}`);
      });
      process.exit(1);
    }

    console.log('✅ Eligible beneficiaries:');
    eligibleBeneficiaries.forEach(b => {
      console.log(`   - ${b.first_name} ${b.last_name} (${b.category})`);
    });
    console.log('');

    // Check existing enrollments
    console.log('🔍 Checking existing enrollments...');
    const existingEnrollments = await Enrollment.findAll({
      where: { program_id: programId }
    });

    const alreadyEnrolledIds = new Set(existingEnrollments.map(e => e.beneficiary_id));
    console.log(`   ${existingEnrollments.length} already enrolled`);
    
    const toEnroll = eligibleBeneficiaries.filter(b => !alreadyEnrolledIds.has(b.id));
    console.log(`   ${toEnroll.length} need to be enrolled`);
    console.log('');

    if (toEnroll.length === 0) {
      console.log('✅ All eligible beneficiaries are already enrolled!');
      
      // Check if they're active
      const activeCount = existingEnrollments.filter(e => e.status === 'active').length;
      console.log(`   ${activeCount} enrollments are active`);
      
      if (activeCount < existingEnrollments.length) {
        console.log('\n⚠️  Some enrollments are not active. Activating them...');
        await Enrollment.update(
          { status: 'active' },
          { where: { program_id: programId } }
        );
        console.log('✅ All enrollments activated!');
      }
      
      process.exit(0);
    }

    console.log('📝 Enrolling beneficiaries...');
    
    const enrollmentData = toEnroll.map(b => ({
      beneficiary_id: b.id,
      program_id: programId,
      enrollment_date: new Date(),
      status: 'active'
    }));

    await Enrollment.bulkCreate(enrollmentData);

    console.log(`✅ Successfully enrolled ${toEnroll.length} beneficiaries!`);
    console.log('');
    
    console.log('═'.repeat(60));
    console.log('SUMMARY:');
    console.log('═'.repeat(60));
    console.log(`Program: ${program.name} (ID: ${programId})`);
    console.log(`Barangay: Anilao (ID: ${barangayId})`);
    console.log(`Total eligible: ${eligibleBeneficiaries.length}`);
    console.log(`Newly enrolled: ${toEnroll.length}`);
    console.log(`Total enrolled: ${eligibleBeneficiaries.length}`);
    console.log('');
    console.log('✅ You can now publish the distribution event!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

enrollBeneficiariesToProgram();
