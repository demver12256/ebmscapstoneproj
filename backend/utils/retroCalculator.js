/**
 * Retroactive Payment Calculation Engine
 * 
 * Calculates retroactive (backpay) amounts for beneficiaries who missed
 * past distribution events when cash/money is involved. This covers:
 * 
 * 1. UNCLAIMED PAST DISTRIBUTIONS: Beneficiary had a 'pending' transaction 
 *    in a completed/archived event (missed claiming / unclaimed cash).
 * 2. LATE ENROLLMENT/APPROVAL: Beneficiary was enrolled/approved after past 
 *    events were already published/completed, so they had no transaction at all.
 * 
 * Works for both program-linked events (e.g. 4Ps, Social Pension) and
 * ad-hoc/sector cash distributions (e.g. Senior Citizen Admin, PWD Admin, MSWDO).
 * 
 * @module utils/retroCalculator
 */

const { Op } = require('sequelize');
const { isNonCashProgram } = require('./nonCashPrograms');

/**
 * Calculate retroactive payment for a single beneficiary.
 * 
 * @param {Object} params
 * @param {number} params.beneficiaryId - The beneficiary's ID
 * @param {number|null} [params.programId] - Optional benefit program's ID
 * @param {string|null} [params.targetCategory] - Optional target category of current event
 * @param {number|null} [params.currentEventId] - The current distribution event ID (to exclude)
 * @param {number} params.amountPerBeneficiary - The standard amount per period
 * @param {Object} params.models - Sequelize models { DistributionEvent, DistributionTransaction, Enrollment, BenefitProgram, Barangay, Beneficiary }
 * @param {Object} [params.transaction] - Optional Sequelize transaction
 * @returns {Promise<{retro_amount: number, retro_periods: number, retro_details: Array}>}
 */
async function calculateRetroForBeneficiary({
  beneficiaryId,
  programId = null,
  targetCategory = null,
  currentEventId = null,
  amountPerBeneficiary = 0,
  models,
  transaction,
}) {
  const DistributionEvent = models.DistributionEvent || require('../db').DistributionEvent;
  const DistributionTransaction = models.DistributionTransaction || require('../db').DistributionTransaction;
  const Enrollment = models.Enrollment || require('../db').Enrollment;
  const BenefitProgram = models.BenefitProgram || require('../db').BenefitProgram;
  const Barangay = models.Barangay || require('../db').Barangay;
  const Beneficiary = models.Beneficiary || require('../db').Beneficiary;

  const retro_details = [];
  let retro_amount = 0;
  let retro_periods = 0;
  const processedEventIds = new Set();
  if (currentEventId) {
    processedEventIds.add(Number(currentEventId));
  }

  // 1. Fetch beneficiary details to verify category & approval dates
  const beneficiary = await Beneficiary.findByPk(beneficiaryId, {
    attributes: ['id', 'category', 'barangay_id', 'status', 'approval_date', 'approved_at', 'createdAt'],
    ...(transaction ? { transaction } : {}),
  });

  if (!beneficiary) {
    return { retro_amount: 0, retro_periods: 0, retro_details: [] };
  }

  // 2. UNCLAIMED PAST TRANSACTIONS:
  // Find all pending (unclaimed) cash transactions from completed or archived events for this beneficiary
  const unclaimedTxns = await DistributionTransaction.findAll({
    where: {
      beneficiary_id: beneficiaryId,
      status: 'pending',
      ...(currentEventId ? { distribution_event_id: { [Op.ne]: currentEventId } } : {}),
    },
    include: [
      {
        model: DistributionEvent,
        as: 'Event',
        where: {
          status: { [Op.in]: ['completed', 'archived'] },
          ...(currentEventId ? { id: { [Op.ne]: currentEventId } } : {}),
        },
        attributes: ['id', 'title', 'program_id', 'target_category', 'benefit_type', 'amount_per_beneficiary', 'distribution_date'],
      },
    ],
    order: [[{ model: DistributionEvent, as: 'Event' }, 'distribution_date', 'ASC']],
    ...(transaction ? { transaction } : {}),
  });

  for (const uTxn of unclaimedTxns) {
    const pastEvt = uTxn.Event;
    if (!pastEvt) continue;
    if (processedEventIds.has(pastEvt.id)) continue;

    // Verify it is a cash disbursement
    const isNonCash = isNonCashProgram(pastEvt.title, pastEvt.benefit_type) || pastEvt.benefit_type !== 'Cash' || uTxn.disbursement_type === 'in_kind' || Boolean(uTxn.item_name);
    if (isNonCash) continue;

    const periodAmount = parseFloat(uTxn.amount);
    if (isNaN(periodAmount) || periodAmount <= 0) continue;

    processedEventIds.add(pastEvt.id);
    retro_amount += periodAmount;
    retro_periods += 1;
    retro_details.push({
      event_id: pastEvt.id,
      event_title: pastEvt.title,
      distribution_date: pastEvt.distribution_date,
      period_amount: periodAmount,
      reason: 'Unclaimed from previous distribution',
      type: 'unclaimed',
      original_transaction_id: uTxn.id,
      original_transaction_number: uTxn.transaction_number,
    });
  }

  // 3. LATE ENROLLMENT / MISSED PAST EVENTS:
  // Check if beneficiary was already approved / eligible during past completed cash events but was never given a transaction
  if (programId) {
    const enrollment = await Enrollment.findOne({
      where: {
        beneficiary_id: beneficiaryId,
        program_id: programId,
        status: 'active',
      },
      ...(transaction ? { transaction } : {}),
    });

    if (enrollment) {
      const eligibilityDate = enrollment.eligibility_date || enrollment.enrollment_date;
      const pastCompletedEvents = await DistributionEvent.findAll({
        where: {
          program_id: programId,
          status: { [Op.in]: ['completed', 'archived'] },
          id: { [Op.notIn]: Array.from(processedEventIds) },
          benefit_type: 'Cash',
        },
        order: [['distribution_date', 'ASC']],
        ...(transaction ? { transaction } : {}),
      });

      for (const pastEvt of pastCompletedEvents) {
        if (processedEventIds.has(pastEvt.id)) continue;
        if (eligibilityDate && new Date(pastEvt.distribution_date) < new Date(eligibilityDate)) {
          continue;
        }

        const existingTxn = await DistributionTransaction.findOne({
          where: {
            distribution_event_id: pastEvt.id,
            beneficiary_id: beneficiaryId,
          },
          ...(transaction ? { transaction } : {}),
        });

        if (!existingTxn) {
          const periodAmount = parseFloat(pastEvt.amount_per_beneficiary) || parseFloat(amountPerBeneficiary) || 0;
          if (periodAmount > 0) {
            processedEventIds.add(pastEvt.id);
            retro_amount += periodAmount;
            retro_periods += 1;
            retro_details.push({
              event_id: pastEvt.id,
              event_title: pastEvt.title,
              distribution_date: pastEvt.distribution_date,
              period_amount: periodAmount,
              reason: 'Not yet enrolled/approved at time of distribution',
              type: 'late_enrollment',
            });
          }
        }
      }
    }
  } else if (beneficiary.barangay_id) {
    // For non-program specific cash events, check if approved beneficiary missed past completed cash events in their barangay
    const eligDate = beneficiary.approval_date || beneficiary.approved_at || beneficiary.createdAt;
    const catSearch = targetCategory || beneficiary.category;

    const pastEvents = await DistributionEvent.findAll({
      where: {
        barangay_id: beneficiary.barangay_id,
        status: { [Op.in]: ['completed', 'archived'] },
        id: { [Op.notIn]: Array.from(processedEventIds) },
        benefit_type: 'Cash',
        ...(catSearch ? { target_category: { [Op.like]: `%${catSearch.split(' ')[0]}%` } } : {}),
      },
      order: [['distribution_date', 'ASC']],
      ...(transaction ? { transaction } : {}),
    });

    for (const pastEvt of pastEvents) {
      if (processedEventIds.has(pastEvt.id)) continue;
      if (eligDate && new Date(pastEvt.distribution_date) < new Date(eligDate)) {
        continue;
      }

      const existingTxn = await DistributionTransaction.findOne({
        where: {
          distribution_event_id: pastEvt.id,
          beneficiary_id: beneficiaryId,
        },
        ...(transaction ? { transaction } : {}),
      });

      if (!existingTxn) {
        const periodAmount = parseFloat(pastEvt.amount_per_beneficiary) || parseFloat(amountPerBeneficiary) || 0;
        if (periodAmount > 0) {
          processedEventIds.add(pastEvt.id);
          retro_amount += periodAmount;
          retro_periods += 1;
          retro_details.push({
            event_id: pastEvt.id,
            event_title: pastEvt.title,
            distribution_date: pastEvt.distribution_date,
            period_amount: periodAmount,
            reason: 'Eligible beneficiary missed during distribution',
            type: 'late_enrollment',
          });
        }
      }
    }
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
 * @param {number|null} [params.programId] - The program ID
 * @param {string|null} [params.targetCategory] - The target category
 * @param {Array} [params.beneficiaries] - Array of Beneficiary objects or IDs
 * @param {Array} [params.enrollments] - Array of enrollment objects (fallback)
 * @param {number} params.amountPerBeneficiary - Standard amount per beneficiary
 * @param {Object} params.models - Sequelize models
 * @param {Object} [params.transaction] - Optional Sequelize transaction
 * @returns {Promise<Object>} Preview summary
 */
async function calculateRetroPreview({
  eventId,
  programId = null,
  targetCategory = null,
  beneficiaries = [],
  enrollments = [],
  amountPerBeneficiary = 0,
  models,
  transaction,
}) {
  let totalRetroAmount = 0;
  let beneficiariesWithRetro = 0;
  const retroBreakdown = [];

  const rawList = beneficiaries && beneficiaries.length > 0
    ? beneficiaries
    : (enrollments || []).map(e => e.Beneficiary || e).filter(Boolean);

  // De-duplicate beneficiaries by id
  const uniqueMap = new Map();
  for (const b of rawList) {
    const id = b.beneficiary_id || b.id;
    if (id && !uniqueMap.has(id)) {
      uniqueMap.set(id, b);
    }
  }
  const beneficiaryList = Array.from(uniqueMap.values());

  for (const b of beneficiaryList) {
    const beneficiaryId = b.beneficiary_id || b.id;
    if (!beneficiaryId) continue;

    const retro = await calculateRetroForBeneficiary({
      beneficiaryId,
      programId,
      targetCategory,
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
        beneficiary_name: b.first_name && b.last_name
          ? `${b.first_name} ${b.last_name}`
          : (b.Beneficiary ? `${b.Beneficiary.first_name} ${b.Beneficiary.last_name}` : `Beneficiary #${beneficiaryId}`),
        beneficiary_code: b.beneficiary_id_code || b.Beneficiary?.beneficiary_id_code,
        retro_amount: retro.retro_amount,
        retro_periods: retro.retro_periods,
        retro_details: retro.retro_details,
      });
    }
  }

  const regularTotal = beneficiaryList.length * parseFloat(amountPerBeneficiary || 0);
  const grandTotal = regularTotal + totalRetroAmount;

  return {
    total_beneficiaries: beneficiaryList.length,
    beneficiaries_with_retro: beneficiariesWithRetro,
    beneficiaries_without_retro: beneficiaryList.length - beneficiariesWithRetro,
    regular_total: Math.round(regularTotal * 100) / 100,
    retro_total: Math.round(totalRetroAmount * 100) / 100,
    grand_total: Math.round(grandTotal * 100) / 100,
    amount_per_beneficiary: parseFloat(amountPerBeneficiary || 0),
    retro_breakdown: retroBreakdown,
  };
}

module.exports = {
  calculateRetroForBeneficiary,
  calculateRetroPreview,
};
