const { sequelize } = require('./db');

async function fixForeignKeys() {
  try {
    console.log('🔍 Inspecting Foreign Key Constraints in MySQL...\n');

    const [fks] = await sequelize.query(`
      SELECT 
        kcu.TABLE_NAME, 
        kcu.CONSTRAINT_NAME, 
        kcu.COLUMN_NAME, 
        kcu.REFERENCED_TABLE_NAME, 
        kcu.REFERENCED_COLUMN_NAME,
        rc.DELETE_RULE,
        rc.UPDATE_RULE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME 
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = DATABASE() 
        AND kcu.REFERENCED_TABLE_NAME IN ('users', 'beneficiaries');
    `);

    console.log(`Found ${fks.length} foreign keys referencing 'users' or 'beneficiaries':\n`);
    fks.forEach(fk => {
      console.log(`- ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME} [Constraint: ${fk.CONSTRAINT_NAME}] (ON DELETE ${fk.DELETE_RULE})`);
    });

    console.log('\n🔧 Updating constraints to ON DELETE CASCADE / SET NULL...\n');

    // Desired delete rules:
    // beneficiaries.user_id -> users.id : CASCADE
    // beneficiary_documents.beneficiary_id -> beneficiaries.id : CASCADE
    // enrollments.beneficiary_id -> beneficiaries.id : CASCADE
    // attendances.beneficiary_id -> beneficiaries.id : CASCADE
    // sms_notifications.beneficiary_id -> beneficiaries.id : CASCADE
    // announcement_recipients.beneficiary_id -> beneficiaries.id : CASCADE
    // announcement_recipients.user_id -> users.id : CASCADE
    // notifications.user_id -> users.id : CASCADE
    // messages.sender_id -> users.id : CASCADE
    // messages.receiver_id -> users.id : CASCADE
    // audit_logs.user_id -> users.id : SET NULL or CASCADE
    // beneficiaries.approving_staff_id -> users.id : SET NULL
    // distribution_transactions.beneficiary_id -> beneficiaries.id : CASCADE
    // distribution_transactions.released_by_staff_id -> users.id : SET NULL
    // distribution_events.assigned_staff_id -> users.id : SET NULL

    const cascadeTargets = [
      { table: 'beneficiaries', column: 'user_id', refTable: 'users', refCol: 'id', action: 'CASCADE' },
      { table: 'beneficiary_documents', column: 'beneficiary_id', refTable: 'beneficiaries', refCol: 'id', action: 'CASCADE' },
      { table: 'enrollments', column: 'beneficiary_id', refTable: 'beneficiaries', refCol: 'id', action: 'CASCADE' },
      { table: 'attendances', column: 'beneficiary_id', refTable: 'beneficiaries', refCol: 'id', action: 'CASCADE' },
      { table: 'sms_notifications', column: 'beneficiary_id', refTable: 'beneficiaries', refCol: 'id', action: 'CASCADE' },
      { table: 'announcement_recipients', column: 'beneficiary_id', refTable: 'beneficiaries', refCol: 'id', action: 'CASCADE' },
      { table: 'announcement_recipients', column: 'user_id', refTable: 'users', refCol: 'id', action: 'CASCADE' },
      { table: 'notifications', column: 'user_id', refTable: 'users', refCol: 'id', action: 'CASCADE' },
      { table: 'messages', column: 'sender_id', refTable: 'users', refCol: 'id', action: 'CASCADE' },
      { table: 'messages', column: 'receiver_id', refTable: 'users', refCol: 'id', action: 'CASCADE' },
      { table: 'distribution_transactions', column: 'beneficiary_id', refTable: 'beneficiaries', refCol: 'id', action: 'CASCADE' },
    ];

    for (const target of cascadeTargets) {
      // Find existing constraint name
      const matching = fks.filter(f => f.TABLE_NAME === target.table && f.COLUMN_NAME === target.column);
      for (const m of matching) {
        if (m.DELETE_RULE !== target.action) {
          console.log(`⚙️  Updating ${target.table}.${target.column} [${m.CONSTRAINT_NAME}] to ON DELETE ${target.action}...`);
          try {
            await sequelize.query(`ALTER TABLE \`${target.table}\` DROP FOREIGN KEY \`${m.CONSTRAINT_NAME}\`;`);
            await sequelize.query(`
              ALTER TABLE \`${target.table}\`
              ADD CONSTRAINT \`${m.CONSTRAINT_NAME}\`
              FOREIGN KEY (\`${target.column}\`)
              REFERENCES \`${target.refTable}\`(\`${target.refCol}\`)
              ON DELETE ${target.action}
              ON UPDATE CASCADE;
            `);
            console.log(`   ✅ Successfully updated ${target.table}.${target.column}`);
          } catch (err) {
            console.error(`   ❌ Failed to update ${m.CONSTRAINT_NAME}:`, err.message);
          }
        } else {
          console.log(`   ✓ ${target.table}.${target.column} already has ON DELETE ${target.action}`);
        }
      }
    }

    console.log('\n🎉 Foreign key constraints update completed!\n');
    await sequelize.close();
  } catch (error) {
    console.error('Error during FK fix:', error);
    await sequelize.close();
  }
}

fixForeignKeys();
