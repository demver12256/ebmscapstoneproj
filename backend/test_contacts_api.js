const { User, sequelize } = require('./db');
const { Op } = require('sequelize');

async function testContactsAPI() {
  try {
    // Simulate the same query that the API uses for staff
    const currentUser = await User.findOne({
      where: { email: 'demver@gmail.com' },
      raw: true
    });

    console.log('✅ Testing as:', currentUser.first_name, currentUser.last_name);
    console.log('   Role:', currentUser.role);
    console.log('   Barangay ID:', currentUser.barangay_id);

    // Build the same whereClause as the API
    let whereClause = { status: 'active' };

    if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      whereClause[Op.or] = [
        { role: 'admin' },
        { 
          role: 'staff',
          barangay_id: currentUser.barangay_id
        },
        { 
          role: 'beneficiary',
          barangay_id: currentUser.barangay_id
        }
      ];
    }

    const contacts = await User.findAll({
      where: {
        ...whereClause,
        id: { [Op.ne]: currentUser.id },
      },
      attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'status', 'barangay_id'],
      order: [['role', 'ASC'], ['first_name', 'ASC']],
      raw: true
    });
    console.log('\n📋 CONTACTS RETURNED:', contacts.length, 'total');
    
    // Group by role
    const byRole = contacts.reduce((acc, c) => {
      acc[c.role] = acc[c.role] || [];
      acc[c.role].push(c);
      return acc;
    }, {});

    console.log('\n📊 Breakdown by Role:');
    for (const [role, users] of Object.entries(byRole)) {
      console.log(`\n${role.toUpperCase()}: ${users.length}`);
      users.forEach(u => {
        console.log(`  - ${u.first_name} ${u.last_name} (barangay_id: ${u.barangay_id})`);
      });
    }

    // Check if there are beneficiaries from other barangays
    const beneficiaries = contacts.filter(c => c.role === 'beneficiary');
    const wrongBarangay = beneficiaries.filter(b => b.barangay_id !== 37);
    
    if (wrongBarangay.length > 0) {
      console.log('\n❌ PROBLEM FOUND!');
      console.log(`Found ${wrongBarangay.length} beneficiaries from OTHER barangays:`);
      wrongBarangay.slice(0, 5).forEach(b => {
        console.log(`  - ${b.first_name} ${b.last_name} (barangay_id: ${b.barangay_id}) - SHOULD NOT BE HERE!`);
      });
    } else {
      console.log('\n✅ All beneficiaries are from barangay_id 37 (Anilao)');
    }

    await sequelize.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
  }
}

testContactsAPI();
