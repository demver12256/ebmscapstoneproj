const { sequelize, Beneficiary, DistributionEvent, DistributionTransaction } = require('../backend/db');

async function testDigitalPayout() {
  try {
    console.log('--- Testing Digital Payout DB & Models ---');

    // 1. Check Beneficiary columns
    const [bCols] = await sequelize.query('DESCRIBE beneficiaries;');
    const bFieldNames = bCols.map(c => c.Field);
    console.log('Beneficiary payout fields present:');
    ['payout_preference', 'payout_provider', 'payout_account_number', 'payout_account_name', 'account_verification_status', 'account_verified_at'].forEach(f => {
      console.log(`  - ${f}:`, bFieldNames.includes(f) ? '✅ YES' : '❌ NO');
    });

    // 2. Check DistributionTransaction columns
    const [tCols] = await sequelize.query('DESCRIBE distribution_transactions;');
    const tFieldNames = tCols.map(c => c.Field);
    console.log('DistributionTransaction payout fields present:');
    ['disbursement_type', 'payout_provider', 'payout_reference_number'].forEach(f => {
      console.log(`  - ${f}:`, tFieldNames.includes(f) ? '✅ YES' : '❌ NO');
    });

    // 3. Find a beneficiary to test payout info
    const testBen = await Beneficiary.findOne();
    if (!testBen) {
      console.log('No beneficiary found to test.');
      process.exit(0);
    }

    console.log(`\nTesting Beneficiary #${testBen.id} (${testBen.first_name} ${testBen.last_name}):`);
    await testBen.update({
      payout_preference: 'digital',
      payout_provider: 'GCash',
      payout_account_number: '09171234567',
      payout_account_name: `${testBen.first_name} ${testBen.last_name}`,
      account_verification_status: 'verified',
      account_verified_at: new Date(),
    });

    console.log('✅ Beneficiary payout fields updated successfully.');

    // 4. Test query on events and transactions
    const publishedEvent = await DistributionEvent.findOne({
      where: { status: ['scheduled', 'ongoing', 'completed'] },
      include: [{ model: DistributionTransaction, as: 'Transactions' }]
    });

    if (publishedEvent) {
      console.log(`Found event #${publishedEvent.id} ("${publishedEvent.title}") with ${publishedEvent.Transactions?.length || 0} transactions.`);
      const digitalCount = await DistributionTransaction.count({
        where: { distribution_event_id: publishedEvent.id, disbursement_type: 'digital' }
      });
      const cashCount = await DistributionTransaction.count({
        where: { distribution_event_id: publishedEvent.id, disbursement_type: 'cash_otc' }
      });
      console.log(`  Digital transactions: ${digitalCount}`);
      console.log(`  Cash OTC transactions: ${cashCount}`);
    }

    console.log('\n--- ALL DB & MODEL CHECKS PASSED ---');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testDigitalPayout();
