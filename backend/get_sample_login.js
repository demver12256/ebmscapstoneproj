require('dotenv').config();
const { Beneficiary, User, Barangay, sequelize } = require('./db');

async function getSampleLogins() {
  try {
    await sequelize.authenticate();
    
    console.log('\n🔐 Sample Beneficiary Login Credentials:\n');
    console.log('Password for all beneficiaries: password123\n');
    
    // Get one beneficiary from each category
    const categories = [
      '4Ps Household Beneficiary',
      'Senior Citizens (Social Pension)',
      'Persons with Disabilities (PWD)'
    ];
    
    for (const category of categories) {
      console.log(`\n📋 ${category}:`);
      console.log('─'.repeat(60));
      
      // Get one IP and one Non-IP
      const ipBeneficiary = await Beneficiary.findOne({
        where: { category, ip_classification: 'IP', status: 'Approved' },
        include: [User, Barangay]
      });
      
      const nonIpBeneficiary = await Beneficiary.findOne({
        where: { category, ip_classification: 'Non-IP', status: 'Approved' },
        include: [User, Barangay]
      });
      
      if (ipBeneficiary) {
        console.log(`\n  IP Beneficiary:`);
        console.log(`    Name: ${ipBeneficiary.first_name} ${ipBeneficiary.last_name}`);
        console.log(`    Email: ${ipBeneficiary.User?.email}`);
        console.log(`    Password: password123`);
        console.log(`    Barangay: ${ipBeneficiary.Barangay?.barangay_name}`);
        console.log(`    Beneficiary ID: ${ipBeneficiary.beneficiary_id_code}`);
        console.log(`    User Status: ${ipBeneficiary.User?.status}`);
        console.log(`    User ID: ${ipBeneficiary.User?.id}`);
      }
      
      if (nonIpBeneficiary) {
        console.log(`\n  Non-IP Beneficiary:`);
        console.log(`    Name: ${nonIpBeneficiary.first_name} ${nonIpBeneficiary.last_name}`);
        console.log(`    Email: ${nonIpBeneficiary.User?.email}`);
        console.log(`    Password: password123`);
        console.log(`    Barangay: ${nonIpBeneficiary.Barangay?.barangay_name}`);
        console.log(`    Beneficiary ID: ${nonIpBeneficiary.beneficiary_id_code}`);
        console.log(`    User Status: ${nonIpBeneficiary.User?.status}`);
        console.log(`    User ID: ${nonIpBeneficiary.User?.id}`);
      }
    }
    
    console.log('\n\n📝 How to Login:');
    console.log('─'.repeat(60));
    console.log('1. Go to the login page');
    console.log('2. Use any email from above');
    console.log('3. Password: password123');
    console.log('4. Click Login\n');
    
    // Check if we can verify password
    const bcrypt = require('bcrypt');
    const testUser = await User.findOne({ where: { role: 'beneficiary' } });
    if (testUser) {
      const isValid = await bcrypt.compare('password123', testUser.password);
      console.log(`✅ Password verification test: ${isValid ? 'PASSED' : 'FAILED'}`);
      if (!isValid) {
        console.log('⚠️  WARNING: Password hashing might be incorrect!\n');
      } else {
        console.log('✅ All beneficiary accounts should be able to login!\n');
      }
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

getSampleLogins();
