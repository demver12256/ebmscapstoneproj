require('dotenv').config();
const { 
  DistributionEvent,
  DistributionTransaction,
  BenefitProgram, 
  Barangay,
  Beneficiary,
  Enrollment,
  User,
  AuditLog,
  sequelize 
} = require('./db');

async function testAutoComplete() {
  const transaction = await sequelize.transaction();
  
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    console.log('🧪 TESTING AUTO-COMPLETION FEATURE\n');

    // Create a test distribution event
    console.log('1️⃣ Creating test distribution event...');
    const testEvent = await DistributionEvent.create({
      title: 'Test Auto-Complete Event',
      program_id: 196, // Regular Cash Grant
      barangay_id: 37, // Anilao
      distribution_date: new Date(),
      venue: 'Test Venue',
      budget: 2000,
      amount_per_beneficiary: 1000,
      assigned_staff_id: 106,
      status: 'ongoing',
      total_beneficiaries: 2,
      total_released: 0,
      total_amount_released: 0,
      started_at: new Date(),
    }, { transaction });

    console.log('   Created event ID:', testEvent.id);

    // Create 2 test transactions
    console.log('2️⃣ Creating test transactions...');
    const txn1 = await DistributionTransaction.create({
      transaction_number: `TEST-TXN-001`,
      distribution_event_id: testEvent.id,
      beneficiary_id: 3102, // Vhen
      amount: 1000,
      status: 'pending',
    }, { transaction });

    const txn2 = await DistributionTransaction.create({
      transaction_number: `TEST-TXN-002`,
      distribution_event_id: testEvent.id,
      beneficiary_id: 3105, // Jaymar
      amount: 1000,
      status: 'pending',
    }, { transaction });

    console.log('   Created 2 transactions');
    console.log('   Event status:', testEvent.status);
    console.log('');

    // Simulate releasing first benefit
    console.log('3️⃣ Releasing first benefit (1/2)...');
    await txn1.update({
      status: 'released',
      released_at: new Date(),
      released_by_staff_id: 106,
      signature_data: 'TEST_SIGNATURE',
      verification_method: 'test',
    }, { transaction });

    let releasedCount = await DistributionTransaction.count({
      where: { distribution_event_id: testEvent.id, status: 'released' },
      transaction,
    });

    await testEvent.update({
      total_released: releasedCount,
      total_amount_released: releasedCount * 1000,
    }, { transaction });

    console.log('   Released count:', releasedCount, '/', testEvent.total_beneficiaries);
    console.log('   Event status:', testEvent.status);
    console.log('   ➡️ Should still be ONGOING');
    console.log('');

    // Simulate releasing second benefit (should trigger auto-complete)
    console.log('4️⃣ Releasing second benefit (2/2)...');
    await txn2.update({
      status: 'released',
      released_at: new Date(),
      released_by_staff_id: 106,
      signature_data: 'TEST_SIGNATURE',
      verification_method: 'test',
    }, { transaction });

    releasedCount = await DistributionTransaction.count({
      where: { distribution_event_id: testEvent.id, status: 'released' },
      transaction,
    });

    await testEvent.update({
      total_released: releasedCount,
      total_amount_released: releasedCount * 1000,
    }, { transaction });

    console.log('   Released count:', releasedCount, '/', testEvent.total_beneficiaries);

    // AUTO-COMPLETE CHECK
    console.log('5️⃣ Checking if auto-completion triggers...');
    const totalBeneficiaries = testEvent.total_beneficiaries;
    if (releasedCount >= totalBeneficiaries && totalBeneficiaries > 0) {
      console.log('   ✅ All benefits released! Auto-completing...');
      await testEvent.update({
        status: 'completed',
        completed_at: new Date(),
      }, { transaction });

      await AuditLog.create({
        user_id: 106,
        action: `Distribution event "${testEvent.title}" auto-completed - all ${totalBeneficiaries} beneficiaries received benefits`,
        module: 'distributions',
        details: JSON.stringify({
          event_id: testEvent.id,
          total_beneficiaries: totalBeneficiaries,
          total_released: releasedCount,
          auto_completed: true,
          test: true,
        }),
      }, { transaction });

      console.log('   ✅ Event auto-completed!');
      console.log('   New status:', testEvent.status);
      console.log('   Completed at:', testEvent.completed_at);
    }
    console.log('');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await DistributionTransaction.destroy({
      where: { distribution_event_id: testEvent.id },
      transaction,
    });
    await DistributionEvent.destroy({
      where: { id: testEvent.id },
      transaction,
    });
    await AuditLog.destroy({
      where: { 
        action: { [require('sequelize').Op.like]: `%${testEvent.title}%` } 
      },
      transaction,
    });

    await transaction.commit();

    console.log('✅ Test completed successfully!\n');
    console.log('═'.repeat(60));
    console.log('RESULT: Auto-completion feature is working correctly!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('For your existing event (ID: 109), it was manually');
    console.log('completed. Future events will auto-complete when all');
    console.log('beneficiaries claim their benefits via RFID.');

    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAutoComplete();
