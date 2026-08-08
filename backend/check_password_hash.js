require('dotenv').config();
const { User, sequelize } = require('./db');
const bcrypt = require('bcrypt');

async function checkPasswordHash() {
  try {
    await sequelize.authenticate();
    
    const user = await User.findOne({ where: { role: 'beneficiary' } });
    
    if (!user) {
      console.log('❌ No beneficiary user found');
      return;
    }
    
    console.log('\n📊 Password Hash Analysis:\n');
    console.log('User Email:', user.email);
    console.log('Password Hash:', user.password);
    console.log('Hash Length:', user.password.length);
    console.log('Starts with $2b$:', user.password.startsWith('$2b$'));
    console.log('Starts with $2a$:', user.password.startsWith('$2a$'));
    
    // Test with bcrypt
    console.log('\n🔐 Testing Password Verification:\n');
    
    try {
      const isValid = await bcrypt.compare('password123', user.password);
      console.log('bcrypt.compare("password123", hash):', isValid);
      
      if (!isValid) {
        console.log('\n⚠️  Password does NOT match!');
        console.log('\nTrying to create correct hash...\n');
        
        const correctHash = await bcrypt.hash('password123', 10);
        console.log('Correct hash for "password123":', correctHash);
        console.log('Correct hash length:', correctHash.length);
        
        const testCorrect = await bcrypt.compare('password123', correctHash);
        console.log('Test with correct hash:', testCorrect ? '✅ PASSED' : '❌ FAILED');
      } else {
        console.log('✅ Password matches correctly!');
      }
    } catch (err) {
      console.log('❌ Error comparing:', err.message);
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPasswordHash();
