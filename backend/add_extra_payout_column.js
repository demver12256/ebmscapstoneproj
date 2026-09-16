const { sequelize } = require('./db');

async function addColumn() {
  try {
    // Check if column exists first
    const [results] = await sequelize.query(
      "SHOW COLUMNS FROM beneficiaries LIKE 'extra_payout_accounts'"
    );
    if (results.length > 0) {
      console.log('Column already exists.');
      process.exit(0);
    }
    await sequelize.query(
      'ALTER TABLE beneficiaries ADD COLUMN extra_payout_accounts TEXT NULL'
    );
    console.log('Column extra_payout_accounts added successfully.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

addColumn();
