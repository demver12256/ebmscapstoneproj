const { DistributionEvent, BenefitProgram, Barangay } = require('./db');

async function checkEvents() {
  try {
    console.log('\n=== Checking Distribution Events ===\n');
    
    const events = await DistributionEvent.findAll({
      include: [
        { model: BenefitProgram, as: 'Program' },
        { model: Barangay }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`Total events: ${events.length}\n`);
    
    events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Program: ${event.Program?.name || 'N/A'}`);
      console.log(`   Barangay: ${event.Barangay?.barangay_name || 'N/A'}`);
      console.log(`   Date: ${event.distribution_date || event.scheduled_date}`);
      console.log('');
    });
    
    const scheduled = events.filter(e => e.status === 'scheduled');
    const ongoing = events.filter(e => e.status === 'ongoing');
    const completed = events.filter(e => e.status === 'completed');
    const draft = events.filter(e => e.status === 'draft');
    
    console.log('Status Summary:');
    console.log(`  Draft: ${draft.length}`);
    console.log(`  Scheduled: ${scheduled.length}`);
    console.log(`  Ongoing: ${ongoing.length}`);
    console.log(`  Completed: ${completed.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEvents();
