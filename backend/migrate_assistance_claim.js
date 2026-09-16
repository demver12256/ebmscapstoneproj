const { sequelize } = require('./db');

async function migrate() {
  try {
    const [cols] = await sequelize.query("SHOW COLUMNS FROM assistance_requests LIKE 'claimed_at'");
    if (cols.length === 0) {
      await sequelize.query(`
        ALTER TABLE assistance_requests 
        ADD COLUMN claimed_at DATETIME NULL,
        ADD COLUMN claimed_by INT NULL,
        ADD COLUMN rfid_scanned VARCHAR(255) NULL,
        ADD COLUMN valid_id_verified TINYINT(1) DEFAULT 0
      `);
      console.log('Columns added successfully to assistance_requests');
    } else {
      console.log('Columns already exist in assistance_requests');
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
