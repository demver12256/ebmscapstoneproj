require('dotenv').config();
const { DistributionEvent, BenefitProgram, Barangay, sequelize } = require('./db');

async function startDistributionSession() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const eventId = 109; // Update this to your event ID

    console.log('📋 Finding distribution event...');
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

    console.log('\n📋 EVENT DETAILS:');
    console.log('─────────────────────────────────────');
    console.log('ID:', event.id);
    console.log('Title:', event.title);
    console.log('Status:', event.status);
    console.log('Program:', event.Program?.name);
    console.log('Barangay:', event.Barangay?.barangay_name);
    console.log('Distribution Date:', event.distribution_date);
    console.log('Budget:', event.budget);
    console.log('Total Beneficiaries:', event.total_beneficiaries);
    console.log('');

    if (event.status === 'ongoing') {
      console.log('✅ Session is already ONGOING!');
      console.log('   You can now use the RFID scanner to release benefits.');
      process.exit(0);
    }

    if (event.status === 'draft') {
      console.log('❌ Event is still in DRAFT status!');
      console.log('   SOLUTION: Go to Distribution Management → Click "Publish" button');
      process.exit(1);
    }

    if (event.status === 'completed') {
      console.log('⚠️  Event is already COMPLETED!');
      console.log('   You cannot restart a completed distribution session.');
      process.exit(1);
    }

    if (event.status === 'scheduled') {
      console.log('🔄 Event is SCHEDULED. Starting distribution session...');
      
      await event.update({
        status: 'ongoing',
        started_at: new Date(),
      });

      console.log('✅ Distribution session started!');
      console.log('');
      console.log('═'.repeat(60));
      console.log('SESSION ACTIVE');
      console.log('═'.repeat(60));
      console.log('Status: ONGOING');
      console.log('Started at:', new Date().toLocaleString());
      console.log('Total Beneficiaries:', event.total_beneficiaries);
      console.log('');
      console.log('✅ You can now use the RFID scanner to release benefits!');
      console.log('   Go to: Dashboard → RFID Distribution Scanner');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

startDistributionSession();
