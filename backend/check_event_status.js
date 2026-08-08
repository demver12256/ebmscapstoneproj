require('dotenv').config();
const { 
  DistributionEvent, 
  DistributionTransaction,
  BenefitProgram, 
  Barangay,
  sequelize 
} = require('./db');

async function checkEventStatus() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const eventId = 109;

    console.log('📋 Checking distribution event...\n');
    const event = await DistributionEvent.findByPk(eventId, {
      include: [
        { model: BenefitProgram, as: 'Program' },
        { model: Barangay }
      ]
    });

    if (!event) {
      console.log('❌ Event not found!');
      process.exit(1);
    }

    console.log('EVENT DETAILS:');
    console.log('─────────────────────────────────────');
    console.log('ID:', event.id);
    console.log('Title:', event.title);
    console.log('Status:', event.status);
    console.log('Total Beneficiaries:', event.total_beneficiaries);
    console.log('Total Released:', event.total_released);
    console.log('Total Amount Released:', event.total_amount_released);
    console.log('');

    // Get all transactions
    const transactions = await DistributionTransaction.findAll({
      where: { distribution_event_id: eventId }
    });

    console.log('TRANSACTIONS:');
    console.log('─────────────────────────────────────');
    console.log('Total transactions:', transactions.length);
    
    const pendingCount = transactions.filter(t => t.status === 'pending').length;
    const releasedCount = transactions.filter(t => t.status === 'released').length;
    
    console.log('Pending:', pendingCount);
    console.log('Released:', releasedCount);
    console.log('');

    transactions.forEach((txn, i) => {
      console.log(`${i + 1}. Transaction ID: ${txn.id}`);
      console.log(`   Status: ${txn.status}`);
      console.log(`   Amount: ₱${txn.amount}`);
      console.log(`   Beneficiary ID: ${txn.beneficiary_id}`);
      console.log('');
    });

    // Check if should be completed
    console.log('COMPLETION CHECK:');
    console.log('─────────────────────────────────────');
    console.log('Total Beneficiaries:', event.total_beneficiaries);
    console.log('Released Count:', releasedCount);
    console.log('All Released?', releasedCount >= event.total_beneficiaries && event.total_beneficiaries > 0);
    console.log('Current Status:', event.status);
    console.log('');

    if (releasedCount >= event.total_beneficiaries && event.total_beneficiaries > 0 && event.status !== 'completed') {
      console.log('⚠️  EVENT SHOULD BE COMPLETED BUT STATUS IS:', event.status);
      console.log('   Manually completing event...');
      
      await event.update({
        status: 'completed',
        completed_at: new Date(),
      });

      console.log('✅ Event manually completed!');
    } else if (event.status === 'completed') {
      console.log('✅ Event is already completed!');
    } else {
      console.log('ℹ️  Event is not ready to be completed yet.');
      console.log(`   Need ${event.total_beneficiaries - releasedCount} more releases.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkEventStatus();
