/**
 * Update Medical Assistance program to accept PWD category
 */

const { BenefitProgram } = require('./db');

async function updateProgramCategory() {
  try {
    console.log('🔍 Finding Medical Assistance program...');
    
    const program = await BenefitProgram.findOne({
      where: { name: 'Medical Assistance' }
    });

    if (!program) {
      console.log('❌ Program not found!');
      return;
    }

    console.log(`✅ Found program: ${program.name}`);
    console.log(`   Current Eligibility Category: ${program.eligibility_category || 'Any'}`);

    // Option A: Set to null/empty to accept ALL categories
    console.log('\n🔄 Updating to accept ALL categories...');
    await program.update({
      eligibility_category: null  // Accept all categories
    });

    // Option B: Set to PWD specifically
    // await program.update({
    //   eligibility_category: 'PWD'
    // });

    console.log('✅ Program updated successfully!');
    console.log(`   New Eligibility Category: ${program.eligibility_category || 'ALL CATEGORIES'}`);
    console.log('\n🎉 PWD beneficiaries are now eligible for this program!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

updateProgramCategory();
