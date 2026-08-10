/**
 * cleanup_seeded_beneficiaries.js
 * Deletes all beneficiary accounts whose email contains '@example.com'
 * and their associated User + Beneficiary records.
 */
const { User, Beneficiary, Enrollment, Notification } = require('./db');
const { Op } = require('sequelize');

async function cleanup() {
  try {
    // Find all users with @example.com emails
    const seededUsers = await User.findAll({
      where: {
        email: { [Op.like]: '%@example.com%' },
        role: 'beneficiary'
      },
      attributes: ['id', 'email']
    });

    if (seededUsers.length === 0) {
      console.log('✅ No seeded beneficiary accounts found. Nothing to delete.');
      return;
    }

    console.log(`🔍 Found ${seededUsers.length} seeded beneficiary accounts to delete...`);
    const userIds = seededUsers.map(u => u.id);

    // Find beneficiary records linked to these users
    const seededBeneficiaries = await Beneficiary.findAll({
      where: { user_id: { [Op.in]: userIds } },
      attributes: ['id']
    });
    const beneficiaryIds = seededBeneficiaries.map(b => b.id);

    console.log(`   - ${beneficiaryIds.length} beneficiary records found`);

    // Delete enrollments for these beneficiaries
    if (beneficiaryIds.length > 0) {
      const deletedEnrollments = await Enrollment.destroy({
        where: { beneficiary_id: { [Op.in]: beneficiaryIds } }
      });
      console.log(`   - Deleted ${deletedEnrollments} enrollment records`);
    }

    // Delete notifications for these users
    try {
      const deletedNotifs = await Notification.destroy({
        where: { user_id: { [Op.in]: userIds } }
      });
      console.log(`   - Deleted ${deletedNotifs} notification records`);
    } catch (e) {
      console.log('   - Skipped notifications (table may not exist)');
    }

    // Delete beneficiary records
    if (beneficiaryIds.length > 0) {
      await Beneficiary.destroy({
        where: { id: { [Op.in]: beneficiaryIds } }
      });
      console.log(`   - Deleted ${beneficiaryIds.length} beneficiary records`);
    }

    // Delete user accounts
    await User.destroy({
      where: { id: { [Op.in]: userIds } }
    });
    console.log(`   - Deleted ${userIds.length} user accounts`);

    console.log('\n✅ Cleanup complete! Only manually-created beneficiaries remain.');

    // Show remaining beneficiary users
    const remaining = await User.findAll({
      where: { role: 'beneficiary' },
      attributes: ['id', 'email']
    });
    console.log(`\n📋 Remaining beneficiary accounts (${remaining.length}):`);
    remaining.forEach(u => console.log(`   - ${u.email}`));

  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
    console.error(err);
  } finally {
    process.exit(0);
  }
}

cleanup();
