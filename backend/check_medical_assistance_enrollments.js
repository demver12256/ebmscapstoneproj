require('dotenv').config();
const { Beneficiary, BenefitProgram, Enrollment, sequelize } = require('./db');

async function checkMedicalAssistance() {
  try {
    await sequelize.authenticate();
    
    // Find Medical Assistance program
    const program = await BenefitProgram.findOne({
      where: { name: 'Medical Assistance' }
    });
    
    if (!program) {
      console.log('❌ Medical Assistance program not found');
      await sequelize.close();
      return;
    }
    
    console.log('\n=== Medical Assistance Program ===');
    console.log(`ID: ${program.id}`);
    console.log(`Name: ${program.name}`);
    console.log(`Eligibility Category: ${program.eligibility_category}`);
    console.log(`Barangay ID: ${program.barangay_id}`);
    console.log(`Status: ${program.status}\n`);
    
    // Check enrollments
    const enrollments = await Enrollment.findAll({
      where: { program_id: program.id },
      include: [
        { model: Beneficiary, attributes: ['id', 'first_name', 'last_name', 'category', 'status', 'barangay_id'] }
      ]
    });
    
    console.log(`=== Enrollments in Medical Assistance: ${enrollments.length} ===\n`);
    
    if (enrollments.length === 0) {
      console.log('❌ No beneficiaries enrolled in Medical Assistance program\n');
    } else {
      enrollments.forEach((enr, index) => {
        console.log(`${index + 1}. ${enr.Beneficiary.first_name} ${enr.Beneficiary.last_name}`);
        console.log(`   ID: ${enr.Beneficiary.id}`);
        console.log(`   Category: ${enr.Beneficiary.category}`);
        console.log(`   Status: ${enr.Beneficiary.status}`);
        console.log(`   Barangay ID: ${enr.Beneficiary.barangay_id}\n`);
      });
    }
    
    // Find eligible beneficiaries who COULD be enrolled
    console.log('=== Eligible Beneficiaries (Not Yet Enrolled) ===\n');
    
    const eligibleBeneficiaries = await Beneficiary.findAll({
      where: {
        category: program.eligibility_category,
        barangay_id: program.barangay_id,
        status: 'Approved'
      }
    });
    
    console.log(`Found ${eligibleBeneficiaries.length} eligible beneficiaries:\n`);
    
    eligibleBeneficiaries.forEach((ben, index) => {
      const isEnrolled = enrollments.some(e => e.Beneficiary.id === ben.id);
      const status = isEnrolled ? '✅ ENROLLED' : '❌ NOT ENROLLED';
      
      console.log(`${index + 1}. ${ben.first_name} ${ben.last_name} - ${status}`);
      console.log(`   ID: ${ben.id}`);
      console.log(`   Category: ${ben.category}`);
      console.log(`   Status: ${ben.status}\n`);
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMedicalAssistance();
