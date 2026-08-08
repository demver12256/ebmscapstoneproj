const {BenefitProgram} = require('./db');

async function activateProgram() {
  try {
    const program = await BenefitProgram.findOne({ where: { name: 'Regular Cash Grant' } });
    
    if (!program) {
      console.log('Program not found');
      process.exit(1);
    }
    
    await program.update({ status: 'active' });
    console.log(`✅ Program "${program.name}" is now ACTIVE`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

activateProgram();
