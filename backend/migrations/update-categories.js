const { connectDatabase, Beneficiary } = require('../db');

async function updateCategories() {
  try {
    console.log('🔄 Updating beneficiary categories...');
    
    // Update all IP to 4Ps Household Beneficiaries
    await Beneficiary.update(
      { category: '4Ps Household Beneficiaries' },
      { where: { category: 'IP' } }
    );
    console.log('✅ Updated IP to 4Ps Household Beneficiaries');

    // Update all Non-IP to Senior Citizens (Social Pension)
    await Beneficiary.update(
      { category: 'Senior Citizens (Social Pension)' },
      { where: { category: 'Non-IP' } }
    );
    console.log('✅ Updated Non-IP to Senior Citizens (Social Pension)');

    console.log('✅ Category migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

if (require.main === module) {
  connectDatabase()
    .then(() => updateCategories())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { updateCategories };
