require('dotenv').config();
const { Beneficiary, Barangay, sequelize } = require('./db');

async function checkCounts() {
  try {
    await sequelize.authenticate();
    
    const total = await Beneficiary.count();
    console.log(`\n📊 Total Beneficiaries: ${total}\n`);
    
    const barangays = await Barangay.findAll({
      attributes: ['id', 'barangay_name'],
      order: [['barangay_name', 'ASC']]
    });
    
    console.log('Beneficiaries per Barangay:');
    console.log('='.repeat(50));
    
    for (const barangay of barangays) {
      const count = await Beneficiary.count({
        where: { barangay_id: barangay.id }
      });
      
      const ipCount = await Beneficiary.count({
        where: { 
          barangay_id: barangay.id,
          ip_classification: 'IP'
        }
      });
      
      const nonIpCount = await Beneficiary.count({
        where: { 
          barangay_id: barangay.id,
          ip_classification: 'Non-IP'
        }
      });
      
      const status = count === 30 ? '✅' : count === 0 ? '❌' : '⚠️';
      console.log(`${status} ${barangay.barangay_name.padEnd(25)} - Total: ${count.toString().padStart(2)} (IP: ${ipCount.toString().padStart(2)}, Non-IP: ${nonIpCount.toString().padStart(2)})`);
    }
    
    console.log('='.repeat(50));
    console.log(`\nTotal Barangays: ${barangays.length}`);
    console.log(`Expected Total Beneficiaries: ${barangays.length * 30}`);
    console.log(`Actual Total Beneficiaries: ${total}`);
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCounts();
