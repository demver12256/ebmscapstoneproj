require('dotenv').config();
const { BenefitProgram, Barangay, User, sequelize } = require('./db');

async function checkProgramAccess() {
  try {
    await sequelize.authenticate();
    
    // Check program 194
    const program = await BenefitProgram.findByPk(194, {
      include: [Barangay]
    });
    
    if (!program) {
      console.log('\n❌ Program 194 not found\n');
      await sequelize.close();
      return;
    }
    
    console.log('\n📋 Program Details:\n');
    console.log(`ID: ${program.id}`);
    console.log(`Name: ${program.name}`);
    console.log(`Category: ${program.eligibility_category}`);
    console.log(`Barangay ID: ${program.barangay_id}`);
    console.log(`Barangay Name: ${program.Barangay?.barangay_name || 'N/A'}\n`);
    
    // Check admin users
    const admins = await User.findAll({
      where: { role: 'admin' },
      include: [Barangay]
    });
    
    console.log(`👤 Admin Users (${admins.length}):\n`);
    admins.forEach(admin => {
      console.log(`  - ${admin.email} (Barangay ID: ${admin.barangay_id || 'NULL'})`);
      if (admin.Barangay) {
        console.log(`    Barangay: ${admin.Barangay.barangay_name}`);
      }
    });
    
    console.log('\n💡 Solution:\n');
    console.log('Option 1: Login as TRUE admin (barangay_id = NULL)');
    console.log('Option 2: Login as staff from the same barangay');
    console.log(`Option 3: Set admin barangay_id to ${program.barangay_id} (${program.Barangay?.barangay_name})\n`);
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProgramAccess();
