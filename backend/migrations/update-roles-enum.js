const { sequelize } = require('../db');

async function updateRolesEnum() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database. Modifying role enum in users table...');

    await sequelize.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'barangay', 'beneficiary') 
      NOT NULL DEFAULT 'beneficiary';
    `);

    console.log('✅ Successfully updated users table role ENUM to include senior_citizen_admin and pwd_admin!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update role ENUM:', error.message);
    process.exit(1);
  }
}

updateRolesEnum();

