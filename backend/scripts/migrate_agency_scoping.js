require('dotenv').config();
const { sequelize } = require('../db');
const { DataTypes } = require('sequelize');

async function migrate() {
  const qi = sequelize.getQueryInterface();

  console.log('--- Migrating benefit_programs table ---');
  const progCols = await qi.describeTable('benefit_programs');
  
  if (!progCols.agency) {
    console.log('Adding agency column to benefit_programs...');
    await qi.addColumn('benefit_programs', 'agency', {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'DSWD',
      comment: 'Agency scope: DSWD or MSWDO',
    });
  } else {
    console.log('agency column already exists in benefit_programs.');
  }

  if (!progCols.created_by) {
    console.log('Adding created_by column to benefit_programs...');
    await qi.addColumn('benefit_programs', 'created_by', {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'User ID of the creator',
    });
  } else {
    console.log('created_by column already exists in benefit_programs.');
  }

  console.log('--- Migrating distribution_events table ---');
  const distCols = await qi.describeTable('distribution_events');

  if (!distCols.agency) {
    console.log('Adding agency column to distribution_events...');
    await qi.addColumn('distribution_events', 'agency', {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'DSWD',
      comment: 'Agency scope: DSWD or MSWDO',
    });
  } else {
    console.log('agency column already exists in distribution_events.');
  }

  if (!distCols.created_by) {
    console.log('Adding created_by column to distribution_events...');
    await qi.addColumn('distribution_events', 'created_by', {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'User ID of the creator',
    });
  } else {
    console.log('created_by column already exists in distribution_events.');
  }

  // Ensure all existing rows have agency = 'DSWD' and created_by = 1 (System Admin DSWD)
  await sequelize.query(`UPDATE benefit_programs SET agency = 'DSWD', created_by = 1 WHERE agency IS NULL OR agency = '' OR created_by IS NULL`);
  await sequelize.query(`UPDATE distribution_events SET agency = 'DSWD', created_by = 1 WHERE agency IS NULL OR agency = '' OR created_by IS NULL`);

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
