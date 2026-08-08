require('dotenv').config();
const { sequelize } = require('./db');
const bcrypt = require('bcrypt');

async function fixPasswordsDirect() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Generate the correct hash for 'password123'
    console.log('🔐 Generating correct password hash for "password123"...');
    const correctHash = await bcrypt.hash('password123', 10);
    console.log(`   Hash: ${correctHash}\n`);
    
    // Verify it works
    const testVerify = await bcrypt.compare('password123', correctHash);
    console.log(`   Verification test: ${testVerify ? '✅ PASSED' : '❌ FAILED'}\n`);
    
    if (!testVerify) {
      console.log('❌ Hash verification failed! Aborting...\n');
      return;
    }
    
    console.log('📊 Updating beneficiary passwords using direct SQL...\n');
    
    // Update all beneficiary users directly via SQL (bypasses model hooks)
    const [results] = await sequelize.query(`
      UPDATE users 
      SET password = :hash 
      WHERE role = 'beneficiary'
    `, {
      replacements: { hash: correctHash }
    });
    
    console.log(`✅ Updated ${results.affectedRows || results.length || 'all'} beneficiary passwords\n`);
    
    // Verify with a sample user
    console.log('🔍 Verifying with random beneficiary users...\n');
    
    const [testUsers] = await sequelize.query(`
      SELECT id, email, password, role 
      FROM users 
      WHERE role = 'beneficiary' 
      LIMIT 5
    `);
    
    let allValid = true;
    for (const user of testUsers) {
      const isValid = await bcrypt.compare('password123', user.password);
      console.log(`   ${user.email}: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      if (!isValid) allValid = false;
    }
    
    if (allValid) {
      console.log('\n✅ ✅ ✅ ALL PASSWORDS FIXED SUCCESSFULLY! ✅ ✅ ✅\n');
      console.log('🎉 All beneficiary accounts can now login with:\n');
      console.log('   Password: password123\n');
      console.log('📧 Sample logins:');
      testUsers.forEach(u => console.log(`   - ${u.email}`));
      console.log('\n');
    } else {
      console.log('\n❌ Some passwords still invalid\n');
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

fixPasswordsDirect();
