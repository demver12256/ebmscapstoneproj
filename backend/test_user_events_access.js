const { User, DistributionEvent, BenefitProgram, Barangay } = require('./db');

async function testUserAccess() {
  try {
    console.log('\n=== Testing User Access to Distribution Events ===\n');
    
    // Get all users
    const users = await User.findAll({
      include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }]
    });
    
    console.log('Users in system:');
    users.forEach(user => {
      console.log(`  ${user.first_name} ${user.last_name} (${user.role}) - Barangay: ${user.Barangay?.barangay_name || 'None'}`);
    });
    
    console.log('\n--- Event Access by Role ---\n');
    
    // Get all events
    const events = await DistributionEvent.findAll({
      where: { status: ['scheduled', 'ongoing'] },
      include: [
        { model: BenefitProgram, as: 'Program' },
        { model: Barangay }
      ]
    });
    
    console.log(`Available Events (scheduled/ongoing): ${events.length}\n`);
    
    events.forEach(event => {
      console.log(`Event: ${event.title}`);
      console.log(`  Status: ${event.status}`);
      console.log(`  Barangay: ${event.Barangay?.barangay_name}`);
      console.log(`  Program: ${event.Program?.name}`);
      console.log('');
    });
    
    // Test access for each user
    console.log('\n--- Who Can See These Events? ---\n');
    
    for (const user of users) {
      console.log(`${user.first_name} ${user.last_name} (${user.role}):`);
      
      if (user.role === 'admin') {
        console.log(`  ✓ Can see ALL ${events.length} events (Admin has full access)`);
      } else if (user.role === 'staff' || user.role === 'barangay') {
        if (!user.barangay_id) {
          console.log('  ✗ Cannot see any events (No barangay assigned)');
        } else {
          const visibleEvents = events.filter(e => e.barangay_id === user.barangay_id);
          console.log(`  ✓ Can see ${visibleEvents.length} events in ${user.Barangay?.barangay_name}`);
          visibleEvents.forEach(e => {
            console.log(`     - ${e.title}`);
          });
        }
      }
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testUserAccess();
