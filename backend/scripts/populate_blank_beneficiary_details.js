const { Beneficiary, User } = require('../db');
const { fillBeneficiaryDummyDetails } = require('../utils/dummyBeneficiaryData');

async function populateAllBlankBeneficiaries() {
  try {
    const beneficiaries = await Beneficiary.findAll({
      include: [{ model: User, as: 'User' }],
    });

    console.log(`[DummyData] Checking ${beneficiaries.length} beneficiaries for blank details...`);
    let updatedCount = 0;

    for (const b of beneficiaries) {
      const patch = fillBeneficiaryDummyDetails(b);

      if (Object.keys(patch).length > 0) {
        await b.update(patch);
        updatedCount++;

        // If phone was generated, sync with User.phone_number
        if (patch.contact_number && b.User) {
          const userPhone = b.User.phone_number ? String(b.User.phone_number).trim() : '';
          if (!userPhone || userPhone === '—' || userPhone === '-') {
            await b.User.update({ phone_number: patch.contact_number });
          }
        }
      }
    }

    console.log(`[DummyData] Successfully populated blank details for ${updatedCount} beneficiaries.`);
    return { success: true, total: beneficiaries.length, updated: updatedCount };
  } catch (error) {
    console.error('[DummyData] Error populating blank beneficiary details:', error.message);
    return { success: false, error: error.message };
  }
}

// Allow running standalone from command line
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
  populateAllBlankBeneficiaries().then((res) => {
    console.log('[DummyData] Run finished:', res);
    process.exit(res.success ? 0 : 1);
  });
}

module.exports = {
  populateAllBlankBeneficiaries,
};
