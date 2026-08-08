const { sequelize } = require('./db');

async function fixCascadeDelete() {
  try {
    console.log('\n=== Fixing Foreign Key Constraints ===\n');

    // Drop and recreate the foreign key with CASCADE
    await sequelize.query(`
      ALTER TABLE distribution_transactions 
      DROP FOREIGN KEY distribution_transactions_ibfk_1;
    `);
    
    console.log('✓ Dropped old foreign key constraint');

    await sequelize.query(`
      ALTER TABLE distribution_transactions
      ADD CONSTRAINT distribution_transactions_ibfk_1
      FOREIGN KEY (distribution_event_id) 
      REFERENCES distribution_events(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    `);
    
    console.log('✓ Added new foreign key constraint with CASCADE');

    console.log('\n✅ Foreign key constraints fixed!\n');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixCascadeDelete();
