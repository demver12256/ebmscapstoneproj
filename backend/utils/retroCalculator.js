/**
 * Retroactive Payment Calculation Engine
 * 
 * Calculates retroactive (backpay) amounts for beneficiaries who missed
 * past distribution events for a given program. This covers:
 * 
 * 1. UNCLAIMED PAST DISTRIBUTIONS: Beneficiary had a 'pending' transaction 
 *    in a completed event (was absent / didn't claim).
 * 2. LATE ENROLLMENT/APPROVAL: Beneficiary was enrolled/approved after past 
 *    events were already published, so they had no transaction at all.
 * 
 * @module utils/retroCalculator
 */

const { Op } = require('sequelize');

/**
 * Calculate retroactive payment for a single beneficiary in a program.
 * 
 * @param {Object} params
 * @param {number} params.beneficiaryId - The beneficiary's ID
 * @param {number} params.programId - The benefit program's ID
 * @param {number} params.currentEventId - The current distribution event ID (to exclude from retro)
 * @param {number} params.amountPerBeneficiary - The standard amount per period
 * @param {Object} params.models - Sequelize models { DistributionEvent, DistributionTransaction, Enrollment, BenefitProgram, Barangay }
 * @param {Object} [params.transaction] - Optional Sequelize transaction
 * @returns {Promise<{retro_amount: number, retro_periods: number, retro_details: Array}>}
 */
async function calculateRetroForBeneficiary({
  beneficiaryId,
  programId,
  currentEventId,
  amountPerBeneficiary,
  models,
  transaction,
}) {
  const { DistributionEvent, DistributionTransaction, Enrollment, BenefitProgram, Barangay } = models;

  const retro_details = [];
  let retro_amount = 0;
  let retro_periods = 0;

  // 1. Find all COMPLETED past distribution events for this same program
  //    (exclude the current event being published)
  const pastCompletedEvents = await DistributionEvent.findAll({
    where: {
      program_id: programId,
      status: { [Op.in]: ['completed', 'archived'] },
      id: { [Op.ne]: currentEventId },
    },
    include: [
      { model: BenefitProgram, as: 'Program', attributes: ['name'] },
      { model: Barangay, attributes: ['barangay_name'] },
    ],
    order: [['distribution_date', 'ASC']],
    ...(transaction ? { transaction } : {}),
  });

  if (pastCompletedEvents.length === 0) {
    return { retro_amount: 0, retro_periods: 0, retro_details: [] };
  }

  // 2. Get the beneficiary's enrollment for this program
  const enrollment = await Enrollment.findOne({
    where: {
      beneficiary_id: beneficiaryId,
      program_id: programId,
      status: 'active',
    },
    ...(transaction ? { transaction } : {}),
  });

  if (!enrollment) {
    return { retro_amount: 0, retro_periods: 0, retro_details: [] };
  }

  // The eligibility anchor date: use eligibility_date if set, otherwise enrollment_date
  const eligibilityDate = enrollment.eligibility_date || enrollment.enrollment_date;

  // 3. For each past completed event, check the beneficiary's situation
  for (const pastEvent of pastCompletedEvents) {
    // Only consider events that fall on or after the eligibility date
    const eventDate = new Date(pastEvent.distribution_date);
    const eligDate = new Date(eligibilityDate);

    if (eventDate < eligDate) {
      // This event was before the beneficiary became eligible — skip
      continue;
    }

    // Check if beneficiary had a transaction in this past event
    const existingTxn = await DistributionTransaction.findOne({
      where: {
        distribution_event_id: pastEvent.id,
        beneficiary_id: beneficiaryId,
      },
      ...(transaction ? { transaction } : {}),
    });

    if (!existingTxn) {
      // CASE: Late enrollment/approval — beneficiary had no transaction at all
      // They should have been included but weren't enrolled/approved at publish time
      const periodAmount = parseFloat(pastEvent.amount_per_beneficiary) || parseFloat(amountPerBeneficiary);
      retro_amount += periodAmount;
      retro_periods += 1;
      retro_details.push({
        event_id: pastEvent.id,
        event_title: pastEvent.title,
        distribution_date: pastEvent.distribution_date,
        period_amount: periodAmount,
        reason: 'Not yet enrolled/approved at time of distribution',
        type: 'late_enrollment',
      });
    } else if (existingTxn.status === 'pending') {
      // CASE: Unclaimed — beneficiary had a pending (unclaimed) transaction
      const periodAmount = parseFloat(existingTxn.amount);
      retro_amount += periodAmount;
      retro_periods += 1;
      retro_details.push({
        event_id: pastEvent.id,
        event_title: pastEvent.title,
        distribution_date: pastEvent.distribution_date,
        period_amount: periodAmount,
        reason: 'Unclaimed from previous distribution',
        type: 'unclaimed',
        original_transaction_id: existingTxn.id,
        original_transaction_number: existingTxn.transaction_number,
      });
    }
    // If status is 'released' — beneficiary already received this, skip
    // If status is 'cancelled' or 'failed' — already handled, skip
  }

  return {
    retro_amount: Math.round(retro_amount * 100) / 100,
    retro_periods,
    retro_details,
  };
}

/**
 * Calculate retro preview for ALL beneficiaries in a distribution event.
 * Used before publishing to show the admin the budget impact.
 * 
 * @param {Object} params
 * @param {number} params.eventId - The distribution event ID
 * @param {Array} params.enrollments - Array of enrollment objects with Beneficiary included
 * @param {number} params.amountPerBeneficiary - Standard amount per beneficiary
 * @param {Object} params.models - Sequelize models
 * @param {Object} [params.transaction] - Optional Sequelize transaction
 * @returns {Promise<Object>} Preview summary
 */
async function calculateRetroPreview({
  eventId,
  programId,
  enrollments,
  amountPerBeneficiary,
  models,
  transaction,
}) {
  let totalRetroAmount = 0;
  let beneficiariesWithRetro = 0;
  const retroBreakdown = [];

  for (const enrollment of enrollments) {
    const beneficiaryId = enrollment.beneficiary_id || enrollment.Beneficiary?.id;
    if (!beneficiaryId) continue;

    const retro = await calculateRetroForBeneficiary({
      beneficiaryId,
      programId,
      currentEventId: eventId,
      amountPerBeneficiary,
      models,
      transaction,
    });

    if (retro.retro_periods > 0) {
      beneficiariesWithRetro += 1;
      totalRetroAmount += retro.retro_amount;
      retroBreakdown.push({
        beneficiary_id: beneficiaryId,
        beneficiary_name: enrollment.Beneficiary
          ? `${enrollment.Beneficiary.first_name} ${enrollment.Beneficiary.last_name}`
          : `Beneficiary #${beneficiaryId}`,
        retro_amount: retro.retro_amount,
        retro_periods: retro.retro_periods,
        retro_details: retro.retro_details,
      });
    }
  }

  const regularTotal = enrollments.length * parseFloat(amountPerBeneficiary);
  const grandTotal = regularTotal + totalRetroAmount;

  return {
    total_beneficiaries: enrollments.length,
    beneficiaries_with_retro: beneficiariesWithRetro,
    beneficiaries_without_retro: enrollments.length - beneficiariesWithRetro,
    regular_total: Math.round(regularTotal * 100) / 100,
    retro_total: Math.round(totalRetroAmount * 100) / 100,
    grand_total: Math.round(grandTotal * 100) / 100,
    amount_per_beneficiary: parseFloat(amountPerBeneficiary),
    retro_breakdown: retroBreakdown,
  };
}

module.exports = {
  calculateRetroForBeneficiary,
  calculateRetroPreview,
};
