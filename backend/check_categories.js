require('dotenv').config();
const { Beneficiary, sequelize } = require('./db');

async function checkCategories() {
  try {
    await sequelize.authenticate();
    
    console.log('\n📊 Beneficiaries by Category:\n');
    
    const categories = await Beneficiary.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category'],
      raw: true
    });
    
    categories.forEach(c => {
      console.log(`${c.category}: ${c.count}`);
    });
    
    console.log('\n📊 Breakdown by Category and IP Classification:\n');
    
    const breakdown = await Beneficiary.findAll({
      attributes: [
        'category',
        'ip_classification',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category', 'ip_classification'],
      order: [['category', 'ASC'], ['ip_classification', 'ASC']],
      raw: true
    });
    
    breakdown.forEach(b => {
      console.log(`${b.category} - ${b.ip_classification}: ${b.count}`);
    });
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCategories();
