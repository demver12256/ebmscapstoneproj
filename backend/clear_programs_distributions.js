const { 
  BenefitProgram, 
  DistributionEvent, 
  DistributionTransaction, 
  Enrollment,
  sequelize 
} = require('./db');

async function clearProgramsAndDistributions() {
  try {
    console.log('🗑️  Starting cleanup of programs and distributions...\n');

    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    // Step 1: Delete all distribution transactions
    const txnCount = await DistributionTransaction.count();
    await DistributionTransaction.destroy({ where: {}, force: true });
    console.log(`✅ Deleted ${txnCount} distribution transaction(s)`);

    // Step 2: Delete all distribution events
    const eventCount = await DistributionEvent.count();
    await DistributionEvent.destroy({ where: {}, force: true });
    console.log(`✅ Deleted ${eventCount} distribution event(s)`);

    // Step 3: Delete all enrollments
    const enrollmentCount = await Enrollment.count();
    await Enrollment.destroy({ where: {}, force: true });
    console.log(`✅ Deleted ${enrollmentCount} enrollment(s)`);

    // Step 4: Delete all programs
    const programCount = await BenefitProgram.count();
    await BenefitProgram.destroy({ where: {}, force: true });
    console.log(`✅ Deleted ${programCount} program(s)`);

    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n✨ All programs and distributions have been cleared successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Programs deleted: ${programCount}`);
    console.log(`   - Enrollments deleted: ${enrollmentCount}`);
    console.log(`   - Distribution events deleted: ${eventCount}`);
    console.log(`   - Distribution transactions deleted: ${txnCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    // Re-enable foreign key checks even if there's an error
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    process.exit(1);
  }
}

clearProgramsAndDistributions();
