require('dotenv').config();
const { sequelize } = require('./db');

async function checkProgramsRaw() {
  try {
    await sequelize.authenticate();
    
    const [programs] = await sequelize.query('SELECT * FROM benefit_programs LIMIT 5');
    
    console.log('\n📊 Raw Program Data:\n');
    console.log(JSON.stringify(programs, null, 2));
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkProgramsRaw();
