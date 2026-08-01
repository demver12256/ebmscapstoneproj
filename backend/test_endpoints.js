const { connectDatabase, sequelize, Beneficiary, BenefitProgram, DistributionTransaction, DistributionEvent, Enrollment } = require('./db');
const { Op } = require('sequelize');

(async () => {
  try {
    await connectDatabase();
    console.log('--- Testing /reports/summary & Barangay-based Programs logic ---');
    const isBarangayScoped = true;
    const barangayId = 2; // Anilao

    const beneficiaryWhere = {};
    if (isBarangayScoped) {
      beneficiaryWhere.barangay_id = barangayId;
    }

    const totalBeneficiaries = await Beneficiary.count({ 
      where: { ...beneficiaryWhere, status: 'Approved' } 
    });
    console.log('totalBeneficiaries:', totalBeneficiaries);
    
    const programWhere = { status: 'active' };
    if (isBarangayScoped && barangayId) {
      programWhere.barangay_id = barangayId;
    }
    const totalPrograms = await BenefitProgram.count({ 
      where: programWhere 
    });
    console.log('totalPrograms for Barangay 2:', totalPrograms);

    const txnWhere = {};
    if (isBarangayScoped && barangayId) {
      txnWhere.distribution_event_id = {
        [Op.in]: sequelize.literal(`(SELECT id FROM distribution_events WHERE barangay_id = ${sequelize.escape(barangayId)})`)
      };
    }

    const totalDistributedFunds = await DistributionTransaction.sum('amount', {
      where: { ...txnWhere, status: 'released' }
    }) || 0;
    console.log('totalDistributedFunds:', totalDistributedFunds);

    const activeBeneficiaries = await Enrollment.count({ 
      where: { 
        status: 'active',
        ...(isBarangayScoped && {
          beneficiary_id: {
            [Op.in]: sequelize.literal(`(
              SELECT id FROM beneficiaries WHERE barangay_id = ${sequelize.escape(barangayId)}
            )`)
          }
        })
      }
    });
    console.log('activeBeneficiaries:', activeBeneficiaries);

    console.log('\n--- ALL TEST PASSED SUCCESSFULLY ---');
    process.exit(0);
  } catch (error) {
    console.error('TEST FAILED WITH ERROR:', error);
    process.exit(1);
  }
})();
