require('dotenv').config();
const { User, Beneficiary, Enrollment, DistributionTransaction, sequelize } = require('./db');

async function removeAllBeneficiaries() {
  const transaction = await sequelize.transaction();
  
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Count existing records
    const beneficiaryCount = await Beneficiary.count();
    const userCount = await User.count({ where: { role: 'beneficiary' } });
    const enrollmentCount = await Enrollment.count();
    const transactionCount = await DistributionTransaction.count();
    
    console.log('📊 Current Database State:');
    console.log(`   Beneficiaries: ${beneficiaryCount}`);
    console.log(`   Beneficiary Users: ${userCount}`);
    console.log(`   Enrollments: ${enrollmentCount}`);
    console.log(`   Distribution Transactions: ${transactionCount}`);
    console.log('');
    
    if (beneficiaryCount === 0 && userCount === 0) {
      console.log('✅ No beneficiary records found. Database is already clean.\n');
      await transaction.commit();
      await sequelize.close();
      return;
    }
    
    console.log('🗑️  Starting deletion process...\n');
    
    // Step 1: Delete all distribution transactions
    console.log('1️⃣  Deleting distribution transactions...');
    const deletedTransactions = await DistributionTransaction.destroy({
      where: {},
      force: true,
      transaction
    });
    console.log(`   ✅ Deleted ${deletedTransactions} transactions\n`);
    
    // Step 2: Delete all enrollments
    console.log('2️⃣  Deleting program enrollments...');
    const deletedEnrollments = await Enrollment.destroy({
      where: {},
      force: true,
      transaction
    });
    console.log(`   ✅ Deleted ${deletedEnrollments} enrollments\n`);
    
    // Step 3: Get all beneficiary user IDs before deleting beneficiaries
    console.log('3️⃣  Collecting beneficiary user IDs...');
    const beneficiaries = await Beneficiary.findAll({
      attributes: ['id', 'user_id'],
      transaction
    });
    const beneficiaryIds = beneficiaries.map(b => b.id);
    const userIds = beneficiaries.map(b => b.user_id).filter(id => id !== null);
    console.log(`   ✅ Found ${beneficiaryIds.length} beneficiaries with ${userIds.length} user accounts\n`);
    
    // Step 4: Delete beneficiary documents first (foreign key constraint)
    console.log('4️⃣  Deleting beneficiary documents...');
    const deletedDocs = await sequelize.query(
      'DELETE FROM beneficiary_documents WHERE beneficiary_id IN (?)',
      { replacements: [beneficiaryIds], type: sequelize.QueryTypes.DELETE, transaction }
    );
    console.log(`   ✅ Deleted beneficiary documents\n`);
    
    // Step 5: Delete all beneficiary records
    console.log('5️⃣  Deleting beneficiary records...');
    const deletedBeneficiaries = await Beneficiary.destroy({
      where: {},
      force: true,
      transaction
    });
    console.log(`   ✅ Deleted ${deletedBeneficiaries} beneficiaries\n`);
    
    // Step 6: Delete all beneficiary user accounts
    console.log('6️⃣  Deleting beneficiary user accounts...');
    const deletedUsers = await User.destroy({
      where: { id: userIds },
      force: true,
      transaction
    });
    console.log(`   ✅ Deleted ${deletedUsers} user accounts\n`);
    
    // Commit transaction
    await transaction.commit();
    
    // Verify deletion
    console.log('🔍 Verifying deletion...\n');
    const remainingBeneficiaries = await Beneficiary.count();
    const remainingUsers = await User.count({ where: { role: 'beneficiary' } });
    const remainingEnrollments = await Enrollment.count();
    const remainingTransactions = await DistributionTransaction.count();
    
    console.log('📊 Final Database State:');
    console.log(`   Beneficiaries: ${remainingBeneficiaries}`);
    console.log(`   Beneficiary Users: ${remainingUsers}`);
    console.log(`   Enrollments: ${remainingEnrollments}`);
    console.log(`   Distribution Transactions: ${remainingTransactions}`);
    console.log('');
    
    if (remainingBeneficiaries === 0 && remainingUsers === 0) {
      console.log('✅ SUCCESS: All beneficiary records removed!\n');
      console.log('📝 Summary:');
      console.log(`   - ${deletedBeneficiaries} beneficiary records deleted`);
      console.log(`   - ${deletedUsers} user accounts deleted`);
      console.log(`   - ${deletedEnrollments} enrollments deleted`);
      console.log(`   - ${deletedTransactions} transactions deleted`);
      console.log('');
    } else {
      console.log('⚠️  WARNING: Some records may still remain\n');
    }
    
    await sequelize.close();
    console.log('🔒 Database connection closed');
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error during deletion:', error.message);
    console.error(error);
    await sequelize.close();
    process.exit(1);
  }
}

// Show confirmation prompt
console.log('⚠️  WARNING: This will DELETE ALL beneficiary records!\n');
console.log('This includes:');
console.log('  - All beneficiary accounts (user role = beneficiary)');
console.log('  - All beneficiary profile data');
console.log('  - All program enrollments');
console.log('  - All distribution transactions');
console.log('');
console.log('Other data will be preserved:');
console.log('  ✅ Admin, staff, and barangay user accounts');
console.log('  ✅ Programs');
console.log('  ✅ Distribution events');
console.log('  ✅ Barangays');
console.log('');
console.log('Starting deletion in 3 seconds...');
console.log('Press Ctrl+C to cancel\n');

setTimeout(() => {
  removeAllBeneficiaries();
}, 3000);
