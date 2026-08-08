require('dotenv').config();
const { User, sequelize } = require('./db');

(async () => {
  try {
    await sequelize.authenticate();
    
    const counts = await User.findAll({
      attributes: [
        'role',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['role']
    });
    
    console.log('\n📊 User Accounts by Role:');
    console.log('======================');
    
    counts.forEach(r => {
      console.log(`${r.role.padEnd(15)} : ${r.dataValues.count}`);
    });
    
    const total = await User.count();
    console.log('======================');
    console.log(`Total Users     : ${total}\n`);
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
