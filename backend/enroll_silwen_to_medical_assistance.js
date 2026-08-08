require('dotenv').config();
const { Beneficiary, BenefitProgram, Enrollment, sequelize } = require('./db');

async function enrollSilwen() {
  try {
    await sequelize.authenticate();
    
    console.log('\n🎯 Enrolling Silwen Galos to Medical Assistance Program\n');
    
    // Find Medical Assistance program
    const program = await BenefitProgram.findOne({
      where: { name: 'Medical Assistance' }
    });
    
    if (!program) {
      console.log('❌ Medical Assistance program not found');
      await sequelize.close();
      return;
    }
    
    console.log(`✅ Found Program: ${program.name} (ID: ${program.id})`);
    console.log(`   Eligibility: ${program.eligibility_category}`);
    console.log(`   Barangay ID: ${program.barangay_id}\n`);
    
    // Find Silwen Galos
    const beneficiary = await Beneficiary.findOne({
      where: { first_name: 'Silwen', last_name: 'Galos' }
    });
    
    if (!beneficiary) {
      console.log('❌ Silwen Galos not found');
      await sequelize.close();
      return;
    }
    
    console.log(`✅ Found Beneficiary: ${beneficiary.first_name} ${beneficiary.last_name} (ID: ${beneficiary.id})`);
    console.log(`   Category: ${beneficiary.category}`);
    console.log(`   Status: ${beneficiary.status}`);
    console.log(`   Barangay ID: ${beneficiary.barangay_id}\n`);
    
    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      where: {
        program_id: program.id,
        beneficiary_id: beneficiary.id
      }
    });
    
    if (existingEnrollment) {
      console.log('⚠️  Silwen is already enrolled in this program');
      console.log(`   Enrollment ID: ${existingEnrollment.id}`);
      console.log(`   Status: ${existingEnrollment.status}`);
      console.log(`   Date: ${existingEnrollment.enrollment_date}\n`);
      await sequelize.close();
      return;
    }
    
    // Create enrollment
    const enrollment = await Enrollment.create({
      program_id: program.id,
      beneficiary_id: beneficiary.id,
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'active'
    });
    
    console.log('✅ Successfully enrolled Silwen Galos!');
    console.log(`   Enrollment ID: ${enrollment.id}`);
    console.log(`   Program: ${program.name}`);
    console.log(`   Beneficiary: ${beneficiary.first_name} ${beneficiary.last_name}`);
    console.log(`   Date: ${enrollment.enrollment_date}`);
    console.log(`   Status: ${enrollment.status}\n`);
    
    console.log('🎉 Enrollment completed successfully!\n');
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

enrollSilwen();
