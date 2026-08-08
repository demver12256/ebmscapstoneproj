require('dotenv').config();
const { User, sequelize } = require('./db');
const bcrypt = require('bcrypt');

async function fixPasswords() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Generate the correct hash for 'password123'
    console.log('🔐 Generating correct password hash...');
    const correctHash = await bcrypt.hash('password123', 10);
    console.log(`   Hash: ${correctHash.substring(0, 20)}...\n`);
    
    // Get all beneficiary users
    const beneficiaryUsers = await User.findAll({
      where: { role: 'beneficiary' }
    });
    
    console.log(`📊 Found ${beneficiaryUsers.length} beneficiary users\n`);
    console.log('🔄 Updating passwords...\n');
    
    let updated = 0;
    for (const user of beneficiaryUsers) {
      await user.update({ password: correctHash });
      updated++;
      
      if (updated % 100 === 0) {
        console.log(`   Progress: ${updated}/${beneficiaryUsers.length}`);
      }
    }
    
    console.log(`\n✅ Successfully updated ${updated} beneficiary passwords!\n`);
    
    // Verify with a sample
    console.log('🔍 Verifying with sample user...\n');
    const testUser = await User.findOne({ where: { role: 'beneficiary' } });
    const isValid = await bcrypt.compare('password123', testUser.password);
    
    if (isValid) {
      console.log('✅ ✅ ✅ PASSWORD VERIFICATION PASSED! ✅ ✅ ✅\n');
      console.log('🎉 All beneficiary accounts can now login with:\n');
      console.log('   Password: password123\n');
      console.log(`📧 Sample login: ${testUser.email}\n`);
    } else {
      console.log('❌ Verification failed - something went wrong\n');
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

fixPasswords();
