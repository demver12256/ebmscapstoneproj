require('dotenv').config();
const { BenefitProgram, DistributionEvent, sequelize } = require('./db');

async function completeProgram() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const programId = 196; // Regular Cash Grant

    console.log('📋 Finding program...');
    const program = await BenefitProgram.findByPk(programId);

    if (!program) {
      console.log('❌ Program not found!');
      process.exit(1);
    }

    console.log('\nPROGRAM DETAILS:');
    console.log('─────────────────────────────────────');
    console.log('ID:', program.id);
    console.log('Name:', program.name);
    console.log('Current Status:', program.status);
    console.log('');

    // Check distribution events
    const events = await DistributionEvent.findAll({
      where: { program_id: programId }
    });

    console.log('DISTRIBUTION EVENTS:');
    console.log('─────────────────────────────────────');
    console.log('Total events:', events.length);
    
    events.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Date: ${event.distribution_date}`);
      console.log(`   Released: ${event.total_released}/${event.total_beneficiaries}`);
    });
    console.log('');

    const completedEvents = events.filter(e => e.status === 'completed');
    const ongoingEvents = events.filter(e => e.status === 'ongoing' || e.status === 'scheduled');

    console.log('SUMMARY:');
    console.log('─────────────────────────────────────');
    console.log('Completed events:', completedEvents.length);
    console.log('Ongoing/Scheduled events:', ongoingEvents.length);
    console.log('');

    if (program.status === 'completed') {
      console.log('✅ Program is already completed!');
      process.exit(0);
    }

    if (completedEvents.length > 0 && ongoingEvents.length === 0) {
      console.log('🔄 All distribution events completed. Completing program...');
      
      await program.update({
        status: 'completed',
      });

      console.log('✅ Program status changed to COMPLETED!');
      console.log('');
      console.log('═'.repeat(60));
      console.log('PROGRAM COMPLETED');
      console.log('═'.repeat(60));
      console.log('Program:', program.name);
      console.log('Status: completed');
      console.log('');
      console.log('✅ Check the Programs page - it should now show as completed!');
    } else if (ongoingEvents.length > 0) {
      console.log('ℹ️  Program still has ongoing/scheduled events.');
      console.log('   Program will remain ACTIVE until all events are completed.');
    } else {
      console.log('ℹ️  No events found for this program.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

completeProgram();
