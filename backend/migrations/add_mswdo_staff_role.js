require('dotenv').config();
const { sequelize } = require('../db');

(async () => {
  try {
    await sequelize.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin','mswdo_admin','senior_citizen_admin','pwd_admin','staff','mswdo_staff','barangay','beneficiary') 
      NOT NULL DEFAULT 'beneficiary';
    `);
    console.log('Successfully updated users.role ENUM in MySQL!');
    const [cols] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'role'");
    console.log('New role column definition:', cols[0]);
  } catch (err) {
    console.error('Error modifying role enum:', err);
  }
  process.exit(0);
})();

