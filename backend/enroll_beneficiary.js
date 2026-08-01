/**
 * Script to manually enroll a beneficiary to a program
 * This fixes the "Not Qualified" issue by creating an active enrollment
 */

const { Beneficiary, BenefitProgram, Enrollment } = require('./db');

async function enrollBeneficiary() {
  try {
    console.log('🔍 Searching for beneficiary: Ponce, Enrique Buenaventura...');
    
    // Find the beneficiary
    const beneficiary = await Beneficiary.findOne({
      where: {
        first_name: 'Enrique',
        last_name: 'Ponce'
      }
    });

    if (!beneficiary) {
      console.log('❌ Beneficiary not found!');
      return;
    }

    console.log(`✅ Found beneficiary: ${beneficiary.first_name} ${beneficiary.last_name} (ID: ${beneficiary.id})`);
    console.log(`   Category: ${beneficiary.category}`);
    console.log(`   Status: ${beneficiary.status}`);

    // Find Medical Assistance program
    console.log('\n🔍 Searching for "Medical Assistance" program...');
    const program = await BenefitProgram.findOne({
      where: {
        name: 'Medical Assistance'
      }
    });

    if (!program) {
      console.log('❌ Medical Assistance program not found!');
      return;
    }

    console.log(`✅ Found program: ${program.name} (ID: ${program.id})`);
    console.log(`   Eligibility Category: ${program.eligibility_category || 'Any'}`);

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      where: {
        beneficiary_id: beneficiary.id,
        program_id: program.id
      }
    });

    if (existingEnrollment) {
      console.log('\n⚠️  Beneficiary is already enrolled!');
      console.log(`   Enrollment Status: ${existingEnrollment.status}`);
      
      if (existingEnrollment.status !== 'active') {
        console.log('\n🔄 Updating enrollment to "active"...');
        await existingEnrollment.update({ status: 'active' });
        console.log('✅ Enrollment status updated to "active"!');
      }
      return;
    }

    // Create enrollment
    console.log('\n📝 Creating new enrollment...');
    const enrollment = await Enrollment.create({
      beneficiary_id: beneficiary.id,
      program_id: program.id,
      enrollment_date: new Date(),
      status: 'active'
    });

    console.log('✅ Enrollment created successfully!');
    console.log(`   Enrollment ID: ${enrollment.id}`);
    console.log(`   Status: ${enrollment.status}`);
    console.log(`   Date: ${enrollment.enrollment_date}`);

    console.log('\n🎉 Beneficiary is now QUALIFIED for the program!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

enrollBeneficiary();
