const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { sequelize, Beneficiary, BenefitProgram, DistributionEvent, DistributionTransaction, Barangay, Enrollment } = require('../db');

const router = express.Router();
router.use(authenticate);

router.get('/summary', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    // Determine scoping based on role
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    // Beneficiary where scoping
    const beneficiaryWhere = {};
    if (isBarangayScoped) {
      beneficiaryWhere.barangay_id = barangayId;
    }

    // ── Core counts ──
    const totalBeneficiaries = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: 'Approved' },
    });

    const programWhere = { status: 'active' };
    if (isBarangayScoped && barangayId) {
      programWhere.barangay_id = barangayId;
    }

    const totalPrograms = await BenefitProgram.count({
      where: programWhere,
    });

    // ── Distribution Event stats ──
    const eventWhere = {};
    if (isBarangayScoped && barangayId) {
      eventWhere.barangay_id = barangayId;
    }

    const totalDistributionEvents = await DistributionEvent.count({ where: eventWhere });
    const scheduledEvents = await DistributionEvent.count({ where: { ...eventWhere, status: 'scheduled' } });
    const ongoingEvents = await DistributionEvent.count({ where: { ...eventWhere, status: 'ongoing' } });
    const completedEvents = await DistributionEvent.count({ where: { ...eventWhere, status: 'completed' } });
    const draftEvents = await DistributionEvent.count({ where: { ...eventWhere, status: 'draft' } });

    // ── Budget stats ──
    const totalBudget = await DistributionEvent.sum('budget', { where: eventWhere }) || 0;
    const budgetUsed = await DistributionEvent.sum('total_amount_released', { where: eventWhere }) || 0;
    const budgetRemaining = totalBudget - budgetUsed;

    // ── Distribution progress ──
    const totalBeneficiariesInEvents = await DistributionEvent.sum('total_beneficiaries', { where: eventWhere }) || 0;
    const totalReleased = await DistributionEvent.sum('total_released', { where: eventWhere }) || 0;
    const distributionProgress = totalBeneficiariesInEvents > 0
      ? Math.round((totalReleased / totalBeneficiariesInEvents) * 100)
      : 0;

    // ── Total distributed funds (from transactions) ──
    const txnWhere = {};
    if (isBarangayScoped && barangayId) {
      txnWhere.distribution_event_id = {
        [Op.in]: sequelize.literal(`(SELECT id FROM distribution_events WHERE barangay_id = ${sequelize.escape(barangayId)})`)
      };
    }
    const totalDistributedFunds = await DistributionTransaction.sum('amount', {
      where: { ...txnWhere, status: 'released' },
    }) || 0;

    // ── Category counts ──
    const fourPsCount = await Beneficiary.count({
      where: {
        ...beneficiaryWhere,
        status: 'Approved',
        category: { [Op.in]: ['4Ps Household Beneficiary', '4Ps Household Beneficiaries'] },
      },
    });

    const seniorCitizensCount = await Beneficiary.count({
      where: {
        ...beneficiaryWhere,
        status: 'Approved',
        category: { [Op.in]: ['Senior Citizen (Social Pension)', 'Senior Citizens (Social Pension)'] },
      },
    });

    const pwdCount = await Beneficiary.count({
      where: {
        ...beneficiaryWhere,
        status: 'Approved',
        category: { [Op.in]: ['Person with Disability (PWD)', 'Persons with Disabilities (PWD)'] },
      },
    });

    // ── Application counts ──
    const pendingApplications = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: 'Pending Review' },
    });

    const underReviewCount = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: 'Under Review' },
    });

    const approvedCount = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: 'Approved' },
    });

    const rejectedCount = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: 'Rejected' },
    });

    // ── Enrollment count ──
    const activeBeneficiaries = await Enrollment.count({
      where: {
        status: 'active',
        ...(isBarangayScoped && barangayId && {
          beneficiary_id: {
            [Op.in]: sequelize.literal(`(SELECT id FROM beneficiaries WHERE barangay_id = ${sequelize.escape(barangayId)})`)
          },
        }),
      },
    });

    // ── Barangay distribution counts ──
    const barangayCounts = await Beneficiary.findAll({
      attributes: ['barangay_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: { ...beneficiaryWhere, status: 'Approved' },
      group: ['barangay_id'],
    });

    // ── Staff-specific stats ──
    let staffStats = null;
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      const assignedEvents = await DistributionEvent.count({
        where: { assigned_staff_id: req.user.id },
      });

      const today = new Date().toISOString().split('T')[0];
      const todayEvents = await DistributionEvent.findAll({
        where: {
          assigned_staff_id: req.user.id,
          distribution_date: today,
          status: { [Op.in]: ['scheduled', 'ongoing'] },
        },
      });

      let todayBeneficiaries = 0;
      let todayReleased = 0;
      let todayPending = 0;
      let todayFailed = 0;

      for (const ev of todayEvents) {
        todayBeneficiaries += ev.total_beneficiaries;
        todayReleased += ev.total_released;

        const failedCount = await DistributionTransaction.count({
          where: { distribution_event_id: ev.id, status: 'failed' },
        });
        todayFailed += failedCount;
        todayPending += (ev.total_beneficiaries - ev.total_released - failedCount);
      }

      staffStats = {
        assignedEvents,
        todayBeneficiaries,
        todayReleased,
        todayPending,
        todayFailed,
      };
    }

    res.json({
      success: true,
      data: {
        totalBeneficiaries,
        totalPrograms,
        totalDistributedFunds,
        activeBeneficiaries,
        fourPsCount,
        seniorCitizensCount,
        pwdCount,
        barangayCounts,
        pendingApplications,
        underReviewCount,
        approvedCount,
        rejectedCount,
        // New distribution event stats
        totalDistributionEvents,
        scheduledEvents,
        ongoingEvents,
        completedEvents,
        draftEvents,
        totalBudget,
        budgetUsed,
        budgetRemaining,
        distributionProgress,
        totalReleased,
        totalBeneficiariesInEvents,
        // Staff-specific
        staffStats,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/monthly-distribution', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    const query = `
      SELECT 
        DATE_FORMAT(dt.released_at, '%Y-%m') as month,
        SUM(dt.amount) as total
      FROM distribution_transactions dt
      INNER JOIN distribution_events de ON dt.distribution_event_id = de.id
      WHERE dt.status = 'released'
        AND dt.released_at IS NOT NULL
        ${isBarangayScoped ? `AND de.barangay_id = ${sequelize.escape(barangayId)}` : ''}
      GROUP BY DATE_FORMAT(dt.released_at, '%Y-%m')
      ORDER BY month ASC
    `;

    const monthly = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });

    res.json({ success: true, data: monthly });
  } catch (error) {
    console.error('Monthly Distribution Error:', error.message);
    next(error);
  }
});

router.get('/debug/distributions-count', authenticate, async (req, res, next) => {
  try {
    const eventCount = await DistributionEvent.count();
    const txnCount = await DistributionTransaction.count();
    const events = await DistributionEvent.findAll({ limit: 5, raw: true });
    res.json({ success: true, eventCount, txnCount, sampleEvents: events });
  } catch (error) {
    next(error);
  }
});

// ── Reports Page Endpoints ──
router.get('/beneficiaries-by-program', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    const programWhere = {};
    if (isBarangayScoped && barangayId) {
      programWhere.barangay_id = barangayId;
    }

    const programs = await BenefitProgram.findAll({
      where: { ...programWhere, status: { [Op.ne]: 'archived' } },
      include: [
        {
          model: Enrollment,
          as: 'Enrollments',
          where: { status: 'active' },
          required: false,
        },
      ],
    });

    const result = programs.map((p) => ({
      program_name: p.name,
      category: p.eligibility_category || p.category,
      beneficiary_count: p.Enrollments?.length || 0,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/recent-distributions', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    const eventWhere = { status: { [Op.ne]: 'draft' } };
    if (isBarangayScoped && barangayId) {
      eventWhere.barangay_id = barangayId;
    }

    const recentEvents = await DistributionEvent.findAll({
      where: eventWhere,
      include: [
        { model: BenefitProgram, as: 'Program', attributes: ['name'] },
        { model: Barangay, as: 'Barangay', attributes: ['barangay_name'] },
      ],
      order: [['distribution_date', 'DESC']],
      limit: 10,
    });

    const result = recentEvents.map((e) => {
      const createdYear = e.created_at ? new Date(e.created_at).getFullYear() : new Date().getFullYear();
      return {
        id: e.id,
        distribution_id: `DIST-${String(createdYear)}-${String(e.id).padStart(4, '0')}`,
        title: e.title,
        program: e.Program?.name || 'N/A',
        barangay: e.Barangay?.barangay_name || 'N/A',
        date: e.distribution_date,
        beneficiaries: e.total_beneficiaries,
        amount: parseFloat(e.total_amount_released),
        status: e.status,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Recent Distributions Error:', error);
    next(error);
  }
});

router.get('/distribution-status', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    const eventWhere = {};
    if (isBarangayScoped && barangayId) {
      eventWhere.barangay_id = barangayId;
    }

    const completed = await DistributionEvent.count({ where: { ...eventWhere, status: 'completed' } });
    const ongoing = await DistributionEvent.count({ where: { ...eventWhere, status: 'ongoing' } });
    const scheduled = await DistributionEvent.count({ where: { ...eventWhere, status: 'scheduled' } });
    const cancelled = await DistributionEvent.count({ where: { ...eventWhere, status: 'archived' } });

    res.json({
      success: true,
      data: [
        { status: 'Completed', count: completed },
        { status: 'Ongoing', count: ongoing },
        { status: 'Scheduled', count: scheduled },
        { status: 'Cancelled', count: cancelled },
      ],
    });
  } catch (error) {
    next(error);
  }
});

router.get('/monthly-aid', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    const query = `
      SELECT 
        DATE_FORMAT(de.distribution_date, '%b') as month,
        SUM(de.total_amount_released) as total
      FROM distribution_events de
      WHERE de.status IN ('completed', 'ongoing')
        AND YEAR(de.distribution_date) = YEAR(CURDATE())
        ${isBarangayScoped ? `AND de.barangay_id = ${sequelize.escape(barangayId)}` : ''}
      GROUP BY DATE_FORMAT(de.distribution_date, '%Y-%m'), DATE_FORMAT(de.distribution_date, '%b')
      ORDER BY DATE_FORMAT(de.distribution_date, '%Y-%m') ASC
    `;

    const result = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
