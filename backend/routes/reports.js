const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { sequelize, Beneficiary, BenefitProgram, DistributionEvent, DistributionTransaction, Barangay, Enrollment, AssistanceRequest, Attendance, Announcement, AnnouncementRecipient, AuditLog, User } = require('../db');
const { isMswdoRole, MSWDO_CATEGORY_FILTER, MSWDO_ELIGIBILITY_FILTER, isMswdoCategory } = require('../utils/roles');

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
    // MSWDO focuses on Senior Citizens and PWD only
    if (isMswdoRole(req.user.role)) {
      beneficiaryWhere[Op.or] = MSWDO_CATEGORY_FILTER[Op.or];
    }

    // ── Core counts ──
    const totalBeneficiaries = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: 'Approved' },
    });

    const programWhere = { status: 'active' };
    if (isBarangayScoped && barangayId) {
      programWhere.barangay_id = barangayId;
    }
    if (isMswdoRole(req.user.role)) {
      programWhere.agency = 'MSWDO';
      programWhere[Op.or] = MSWDO_ELIGIBILITY_FILTER[Op.or];
    } else if (req.user.role === 'admin') {
      programWhere.agency = 'DSWD';
    }

    const totalPrograms = await BenefitProgram.count({
      where: programWhere,
    });

    // ── Distribution Event stats ──
    const eventWhere = {};
    if (isBarangayScoped && barangayId) {
      eventWhere.barangay_id = barangayId;
    }
    if (isMswdoRole(req.user.role)) {
      eventWhere.agency = 'MSWDO';
    } else if (req.user.role === 'admin') {
      eventWhere.agency = 'DSWD';
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
    if (isMswdoRole(req.user.role)) {
      txnWhere.distribution_event_id = {
        [Op.in]: sequelize.literal(`(SELECT id FROM distribution_events WHERE agency = 'MSWDO')`)
      };
    } else if (req.user.role === 'admin') {
      txnWhere.distribution_event_id = {
        [Op.in]: sequelize.literal(`(SELECT id FROM distribution_events WHERE agency = 'DSWD')`)
      };
    }
    const regularFunds = await DistributionTransaction.sum('amount', {
      where: { ...txnWhere, status: 'released' },
    }) || 0;
    const retroFunds = await DistributionTransaction.sum('retro_amount', {
      where: { ...txnWhere, status: 'released' },
    }) || 0;
    const totalDistributedFunds = parseFloat(regularFunds) + parseFloat(retroFunds);

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
      where: { ...beneficiaryWhere, status: { [Op.in]: ['Pending Review', 'Under Review', 'pending', 'Pending'] } },
    });

    const underReviewCount = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: { [Op.in]: ['Under Review', 'under_review'] } },
    });

    const approvedCount = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: 'Approved' },
    });

    const rejectedCount = await Beneficiary.count({
      where: { ...beneficiaryWhere, status: 'Rejected' },
    });

    // ── Enrollment count ──
    let enrollWhere = { status: 'active' };
    if (isBarangayScoped && barangayId) {
      enrollWhere.beneficiary_id = {
        [Op.in]: sequelize.literal(`(SELECT id FROM beneficiaries WHERE barangay_id = ${sequelize.escape(barangayId)})`)
      };
    }
    if (isMswdoRole(req.user.role)) {
      enrollWhere.program_id = {
        [Op.in]: sequelize.literal(`(SELECT id FROM benefit_programs WHERE agency = 'MSWDO')`)
      };
      const mswdoSub = `(SELECT id FROM beneficiaries WHERE category LIKE '%Senior%' OR category LIKE '%PWD%' OR category LIKE '%Disabilit%')`;
      if (enrollWhere.beneficiary_id) {
        enrollWhere.beneficiary_id = {
          [Op.in]: sequelize.literal(`(SELECT id FROM beneficiaries WHERE barangay_id = ${sequelize.escape(barangayId)} AND (category LIKE '%Senior%' OR category LIKE '%PWD%' OR category LIKE '%Disabilit%'))`)
        };
      } else {
        enrollWhere.beneficiary_id = { [Op.in]: sequelize.literal(mswdoSub) };
      }
    }
    const activeBeneficiaries = await Enrollment.count({
      where: enrollWhere,
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
    const isMswdo = isMswdoRole(req.user.role);

    const query = `
      SELECT 
        DATE_FORMAT(dt.released_at, '%Y-%m') as month,
        SUM(dt.amount) as total
      FROM distribution_transactions dt
      INNER JOIN distribution_events de ON dt.distribution_event_id = de.id
      ${isMswdo ? `INNER JOIN benefit_programs bp ON de.program_id = bp.id` : ''}
      WHERE dt.status = 'released'
        AND dt.released_at IS NOT NULL
        ${isBarangayScoped ? `AND de.barangay_id = ${sequelize.escape(barangayId)}` : ''}
      ${isMswdo ? `AND de.agency = 'MSWDO'` : (req.user.role === 'admin' ? `AND de.agency = 'DSWD'` : '')}
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
    if (isMswdoRole(req.user.role)) {
      programWhere.agency = 'MSWDO';
      programWhere[Op.or] = MSWDO_ELIGIBILITY_FILTER[Op.or];
    } else if (req.user.role === 'admin') {
      programWhere.agency = 'DSWD';
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

    // Get filter parameters from query string
    const { program_id, barangay_id, start_date, end_date, page = 1, limit = 10 } = req.query;

    const eventWhere = {};
    
    // Don't exclude draft by default - let users see all statuses
    // Remove: { status: { [Op.ne]: 'draft' } }
    
    // Apply barangay scope based on role
    if (isBarangayScoped && barangayId) {
      eventWhere.barangay_id = barangayId;
    }

    // Apply program filter
    if (program_id) {
      eventWhere.program_id = program_id;
    }

    // Apply barangay filter (if user is admin and specifies a barangay)
    if (barangay_id && !isBarangayScoped) {
      eventWhere.barangay_id = barangay_id;
    }

    // Apply date range filter
    if (start_date && end_date) {
      eventWhere.distribution_date = {
        [Op.between]: [start_date, end_date]
      };
    } else if (start_date) {
      eventWhere.distribution_date = {
        [Op.gte]: start_date
      };
    } else if (end_date) {
      eventWhere.distribution_date = {
        [Op.lte]: end_date
      };
    }

    // Agency-level scoping: MSWDO sees ONLY MSWDO distributions; DSWD sees DSWD
    if (isMswdoRole(req.user.role)) {
      eventWhere.agency = 'MSWDO';
    } else if (req.user.role === 'admin') {
      eventWhere.agency = 'DSWD';
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const totalCount = await DistributionEvent.count({ where: eventWhere });

    // Fetch paginated results
    const recentEvents = await DistributionEvent.findAll({
      where: eventWhere,
      include: [
        { model: BenefitProgram, as: 'Program', attributes: ['id', 'name'] },
        { model: Barangay, as: 'Barangay', attributes: ['id', 'barangay_name'] },
      ],
      order: [['distribution_date', 'DESC']],
      limit: parseInt(limit),
      offset: offset,
    });

    const result = await Promise.all(recentEvents.map(async (e) => {
      const createdYear = e.createdAt ? new Date(e.createdAt).getFullYear() : new Date().getFullYear();
      
      // Get transaction counts for this event
      const releasedCount = await DistributionTransaction.count({
        where: { distribution_event_id: e.id, status: 'released' }
      });
      
      const totalBeneficiaries = e.total_beneficiaries || 0;
      const nonReleasedCount = await DistributionTransaction.count({
        where: { distribution_event_id: e.id, status: { [Op.ne]: 'released' } }
      });
      const pendingCount = Math.max(nonReleasedCount, Math.max(0, totalBeneficiaries - releasedCount));
      
      // Get all beneficiaries for the report, while keeping the UI preview limited to 5.
      const allTransactions = await DistributionTransaction.findAll({
        where: { distribution_event_id: e.id },
        include: [
          {
            model: Beneficiary,
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'beneficiary_id_code']
          }
        ],
        order: [['id', 'ASC']]
      });

      const pendingTransactions = allTransactions
        .filter((txn) => txn.status !== 'released')
        .slice(0, 5);
      
      const pendingBeneficiaries = pendingTransactions.map(txn => ({
        id: txn.Beneficiary?.id,
        name: txn.Beneficiary ? 
          `${txn.Beneficiary.first_name} ${txn.Beneficiary.middle_name ? txn.Beneficiary.middle_name + ' ' : ''}${txn.Beneficiary.last_name}`.trim() 
          : 'Unknown',
        beneficiary_id: txn.Beneficiary?.beneficiary_id_code || null,
      }));
      
      return {
        id: e.id,
        distribution_id: `DIST-${String(createdYear)}-${String(e.id).padStart(4, '0')}`,
        title: e.title,
        program: e.Program?.name || 'N/A',
        program_id: e.Program?.id || null,
        barangay: e.Barangay?.barangay_name || 'N/A',
        barangay_id: e.Barangay?.id || null,
        date: e.distribution_date,
        beneficiaries: totalBeneficiaries,
        released_count: releasedCount,
        pending_count: pendingCount,
        pending_beneficiaries: pendingBeneficiaries,
        beneficiary_names: allTransactions
          .map((txn) => txn.Beneficiary ? `${txn.Beneficiary.first_name} ${txn.Beneficiary.middle_name ? txn.Beneficiary.middle_name + ' ' : ''}${txn.Beneficiary.last_name}`.trim() : null)
          .filter(Boolean),
        amount: parseFloat(e.total_amount_released),
        status: e.status,
      };
    }));

    res.json({ 
      success: true, 
      data: result,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
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
    if (isMswdoRole(req.user.role)) {
      eventWhere.agency = 'MSWDO';
    } else if (req.user.role === 'admin') {
      eventWhere.agency = 'DSWD';
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
    const isMswdo = isMswdoRole(req.user.role);

    const query = `
      SELECT 
        DATE_FORMAT(de.distribution_date, '%b') as month,
        SUM(de.total_amount_released) as total
      FROM distribution_events de
      WHERE de.status IN ('completed', 'ongoing')
        AND YEAR(de.distribution_date) = YEAR(CURDATE())
        ${isBarangayScoped ? `AND de.barangay_id = ${sequelize.escape(barangayId)}` : ''}
        ${isMswdo ? `AND de.agency = 'MSWDO'` : (req.user.role === 'admin' ? `AND de.agency = 'DSWD'` : '')}
      GROUP BY DATE_FORMAT(de.distribution_date, '%Y-%m'), DATE_FORMAT(de.distribution_date, '%b')
      ORDER BY DATE_FORMAT(de.distribution_date, '%Y-%m') ASC
    `;

    const result = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ── Export Endpoints ──

// Helper to escape CSV values
function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers, rows) {
  const headerLine = headers.join(',');
  const dataLines = rows.map(row => row.map(csvEscape).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// Export Beneficiary List as CSV — MSWDO limited to Senior/PWD
router.get('/export/beneficiaries', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { program_id, barangay_id: qBarangay, category } = req.query;

    const where = { status: 'Approved' };
    if (isBarangayScoped && barangayId) where.barangay_id = barangayId;
    else if (qBarangay) where.barangay_id = qBarangay;
    if (isMswdoRole(req.user.role)) {
      // Enforce Senior/PWD/4Ps even if category query provided
      const cat = category || '';
      const lower = String(cat).toLowerCase();
      if (!cat || (!lower.includes('senior') && !lower.includes('pwd') && !lower.includes('disabilit') && !lower.includes('4ps') && !lower.includes('pantawid'))) {
        where[Op.or] = MSWDO_CATEGORY_FILTER[Op.or];
      } else {
        where.category = category;
      }
    } else if (category) where.category = category;

    const beneficiaries = await Beneficiary.findAll({
      where,
      include: [
        { model: Barangay, attributes: ['barangay_name'] },
      ],
      order: [['last_name', 'ASC']],
    });

    const headers = ['ID', 'First Name', 'Last Name', 'Middle Name', 'Category', 'Barangay', 'Status', 'Date Registered'];
    const rows = beneficiaries.map(b => [
      b.id,
      b.first_name,
      b.last_name,
      b.middle_name || '',
      b.category || '',
      b.Barangay?.barangay_name || '',
      b.status,
      b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US') : '',
    ]);

    const csv = toCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="beneficiary-list.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export Distribution Report as CSV
router.get('/export/distributions', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { program_id, barangay_id: qBarangay, start_date, end_date, status: qStatus } = req.query;

    const eventWhere = {};
    if (isBarangayScoped && barangayId) eventWhere.barangay_id = barangayId;
    else if (qBarangay) eventWhere.barangay_id = qBarangay;
    if (isMswdoRole(req.user.role)) {
      eventWhere.agency = 'MSWDO';
    } else if (req.user.role === 'admin') {
      eventWhere.agency = 'DSWD';
    }
    if (program_id) eventWhere.program_id = program_id;
    if (qStatus) eventWhere.status = qStatus;
    if (start_date && end_date) {
      eventWhere.distribution_date = { [Op.between]: [start_date, end_date] };
    } else if (start_date) {
      eventWhere.distribution_date = { [Op.gte]: start_date };
    } else if (end_date) {
      eventWhere.distribution_date = { [Op.lte]: end_date };
    }

    const events = await DistributionEvent.findAll({
      where: eventWhere,
      include: [
        { model: BenefitProgram, as: 'Program', attributes: ['name'] },
        { model: Barangay, as: 'Barangay', attributes: ['barangay_name'] },
      ],
      order: [['distribution_date', 'DESC']],
    });

    const headers = ['Distribution ID', 'Title', 'Program', 'Barangay', 'Date', 'Beneficiaries', 'Amount Released', 'Status'];
    const rows = events.map(e => {
      const year = e.createdAt ? new Date(e.createdAt).getFullYear() : new Date().getFullYear();
      return [
        `DIST-${year}-${String(e.id).padStart(4, '0')}`,
        e.title,
        e.Program?.name || 'N/A',
        e.Barangay?.barangay_name || 'N/A',
        e.distribution_date || '',
        e.total_beneficiaries || 0,
        parseFloat(e.total_amount_released || 0).toFixed(2),
        e.status,
      ];
    });

    const csv = toCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="distribution-report.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export Program Summary as CSV — MSWDO limited to Senior/PWD programs
router.get('/export/programs', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    const programWhere = {};
    if (isBarangayScoped && barangayId) programWhere.barangay_id = barangayId;
    if (isMswdoRole(req.user.role)) {
      programWhere.agency = 'MSWDO';
      programWhere[Op.or] = MSWDO_ELIGIBILITY_FILTER[Op.or];
    } else if (req.user.role === 'admin') {
      programWhere.agency = 'DSWD';
    }

    const programs = await BenefitProgram.findAll({
      where: { ...programWhere, status: { [Op.ne]: 'archived' } },
      include: [
        { model: Barangay, attributes: ['barangay_name'] },
        { model: Enrollment, as: 'Enrollments', where: { status: 'active' }, required: false },
      ],
    });

    const headers = ['Program Name', 'Category', 'Barangay', 'Status', 'Active Enrollments', 'Budget'];
    const rows = programs.map(p => [
      p.name,
      p.eligibility_category || p.category || '',
      p.Barangay?.barangay_name || '',
      p.status,
      p.Enrollments?.length || 0,
      parseFloat(p.budget || 0).toFixed(2),
    ]);

    const csv = toCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="program-report.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// Export Enrollment Report as CSV — MSWDO limited to Senior/PWD
router.get('/export/enrollments', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { program_id } = req.query;

    const enrollWhere = { status: 'active' };
    const benWhere = { status: 'Approved' };
    if (isBarangayScoped && barangayId) benWhere.barangay_id = barangayId;
    if (isMswdoRole(req.user.role)) {
      benWhere[Op.or] = MSWDO_CATEGORY_FILTER[Op.or];
      enrollWhere.program_id = {
        [Op.in]: sequelize.literal(`(SELECT id FROM benefit_programs WHERE agency = 'MSWDO')`)
      };
    } else if (req.user.role === 'admin') {
      enrollWhere.program_id = {
        [Op.in]: sequelize.literal(`(SELECT id FROM benefit_programs WHERE agency = 'DSWD')`)
      };
    }
    if (program_id) {
      if (isMswdoRole(req.user.role)) {
        const prog = await BenefitProgram.findByPk(program_id);
        if (!prog || !isMswdoCategory(prog.eligibility_category)) {
          return res.setHeader('Content-Type', 'text/csv').setHeader('Content-Disposition', 'attachment; filename="enrollment-report.csv"').send('Enrollment ID,Beneficiary Name,Category,Barangay,Program,Status,Date Enrolled\n');
        }
      }
      enrollWhere.program_id = program_id;
    }

    const enrollments = await Enrollment.findAll({
      where: enrollWhere,
      include: [
        { model: Beneficiary, where: benWhere, include: [{ model: Barangay, attributes: ['barangay_name'] }] },
        { model: BenefitProgram, attributes: ['name', 'eligibility_category'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const headers = ['Enrollment ID', 'Beneficiary Name', 'Category', 'Barangay', 'Program', 'Status', 'Date Enrolled'];
    const rows = enrollments.map(en => [
      en.id,
      `${en.Beneficiary?.first_name || ''} ${en.Beneficiary?.last_name || ''}`.trim(),
      en.Beneficiary?.category || '',
      en.Beneficiary?.Barangay?.barangay_name || '',
      en.BenefitProgram?.name || '',
      en.status,
      en.createdAt ? new Date(en.createdAt).toLocaleDateString('en-US') : '',
    ]);

    const csv = toCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="enrollment-report.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// ── Table JSON Endpoints ──

// Beneficiaries table JSON — MSWDO limited to Senior/PWD
router.get('/table/beneficiaries', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { barangay_id: qBarangay, program_id, page = 1, limit = 10 } = req.query;

    const where = { status: 'Approved' };
    if (isBarangayScoped && barangayId) where.barangay_id = barangayId;
    else if (qBarangay) where.barangay_id = qBarangay;
    if (isMswdoRole(req.user.role)) {
      where[Op.or] = MSWDO_CATEGORY_FILTER[Op.or];
    }

    // Filter by program if specified
    if (program_id) {
      where.id = {
        [Op.in]: sequelize.literal(`(SELECT beneficiary_id FROM enrollments WHERE program_id = ${sequelize.escape(program_id)} AND status = 'active')`)
      };
      // For MSWDO, ensure program is Senior/PWD eligible — if not, return empty
      if (isMswdoRole(req.user.role)) {
        const prog = await BenefitProgram.findByPk(program_id);
        if (prog && !isMswdoCategory(prog.eligibility_category)) {
          return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: parseInt(limit), totalPages: 0 } });
        }
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Beneficiary.findAndCountAll({
      where,
      include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
      order: [['last_name', 'ASC']],
      limit: parseInt(limit),
      offset,
    });

    const data = rows.map(b => ({
      id: b.id,
      first_name: b.first_name,
      last_name: b.last_name,
      category: b.category,
      barangay_name: b.Barangay?.barangay_name || 'N/A',
      status: b.status,
      created_at: b.createdAt,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)) || 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// Programs table JSON — MSWDO limited to Senior/PWD programs
router.get('/table/programs', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { barangay_id: qBarangay, page = 1, limit = 10 } = req.query;

    const programWhere = { status: { [Op.ne]: 'archived' } };
    if (isBarangayScoped && barangayId) programWhere.barangay_id = barangayId;
    else if (qBarangay) programWhere.barangay_id = qBarangay;
    if (isMswdoRole(req.user.role)) {
      programWhere.agency = 'MSWDO';
      programWhere[Op.or] = MSWDO_ELIGIBILITY_FILTER[Op.or];
    } else if (req.user.role === 'admin') {
      programWhere.agency = 'DSWD';
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await BenefitProgram.findAndCountAll({
      where: programWhere,
      include: [
        { model: Barangay, attributes: ['id', 'barangay_name'] },
        { model: Enrollment, as: 'Enrollments', where: { status: 'active' }, required: false },
      ],
      limit: parseInt(limit),
      offset,
    });

    const data = rows.map(p => ({
      id: p.id,
      name: p.name,
      category: p.eligibility_category || p.category,
      barangay_name: p.Barangay?.barangay_name || 'All Barangays',
      status: p.status,
      enrollment_count: p.Enrollments?.length || 0,
      budget: p.budget,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)) || 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// Enrollments table JSON — MSWDO limited to Senior/PWD
router.get('/table/enrollments', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { program_id, barangay_id: qBarangay, page = 1, limit = 10 } = req.query;

    const enrollWhere = { status: 'active' };
    if (program_id) {
      if (isMswdoRole(req.user.role)) {
        const prog = await BenefitProgram.findByPk(program_id);
        if (!prog || prog.agency !== 'MSWDO' || !isMswdoCategory(prog.eligibility_category)) {
          return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: parseInt(limit), totalPages: 0 } });
        }
      }
      enrollWhere.program_id = program_id;
    } else if (isMswdoRole(req.user.role)) {
      enrollWhere.program_id = { [Op.in]: sequelize.literal(`(SELECT id FROM benefit_programs WHERE agency = 'MSWDO')`) };
    } else if (req.user.role === 'admin') {
      enrollWhere.program_id = { [Op.in]: sequelize.literal(`(SELECT id FROM benefit_programs WHERE agency = 'DSWD')`) };
    }

    const benWhere = { status: 'Approved' };
    if (isBarangayScoped && barangayId) benWhere.barangay_id = barangayId;
    else if (qBarangay) benWhere.barangay_id = qBarangay;
    if (isMswdoRole(req.user.role)) {
      benWhere[Op.or] = MSWDO_CATEGORY_FILTER[Op.or];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Enrollment.findAndCountAll({
      where: enrollWhere,
      include: [
        { model: Beneficiary, where: benWhere, include: [{ model: Barangay, attributes: ['barangay_name'] }] },
        { model: BenefitProgram, attributes: ['name', 'eligibility_category'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    const data = rows.map(en => ({
      id: en.id,
      beneficiary_name: `${en.Beneficiary?.first_name || ''} ${en.Beneficiary?.last_name || ''}`.trim(),
      category: en.Beneficiary?.category,
      barangay_name: en.Beneficiary?.Barangay?.barangay_name || 'N/A',
      program_name: en.BenefitProgram?.name,
      status: en.status,
      created_at: en.createdAt,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)) || 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// ── Assistance Requests Table JSON ──
router.get('/table/assistance-requests', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { barangay_id: qBarangay, status: qStatus, page = 1, limit = 10 } = req.query;

    const where = {};
    if (isBarangayScoped && barangayId) {
      where.barangay_id = barangayId;
    } else if (qBarangay) {
      where.barangay_id = qBarangay;
    }
    if (isMswdoRole(req.user.role)) {
      where.agency = 'MSWDO';
    } else if (req.user.role === 'admin') {
      where.agency = 'DSWD';
    }
    if (qStatus) where.status = qStatus;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await AssistanceRequest.findAndCountAll({
      where,
      include: [
        { model: Beneficiary, attributes: ['id', 'first_name', 'last_name', 'category'] },
        { model: Barangay, attributes: ['id', 'barangay_name'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    const data = rows.map(r => ({
      id: r.id,
      beneficiary_name: r.Beneficiary ? `${r.Beneficiary.first_name} ${r.Beneficiary.last_name}` : 'N/A',
      category: r.Beneficiary?.category || '—',
      type: r.type,
      subject: r.subject,
      barangay_name: r.Barangay?.barangay_name || 'N/A',
      status: r.status,
      priority: r.priority,
      created_at: r.createdAt,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)) || 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// ── Attendance Table JSON ──
router.get('/table/attendance', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { page = 1, limit = 10 } = req.query;

    const announcementScopeWhere = {};
    if (isMswdoRole(req.user.role)) {
      const mswdoAnnouncements = await Announcement.findAll({
        where: { created_by_user_id: req.user.id },
        attributes: ['id'],
      });
      announcementScopeWhere.id = { [Op.in]: mswdoAnnouncements.map(a => a.id) };
    }

    const benWhere = {};
    if (isBarangayScoped && barangayId) {
      benWhere.barangay_id = barangayId;
    }

    const attendanceWhere = {};
    if (Object.keys(announcementScopeWhere).length > 0) {
      attendanceWhere.announcement_id = { [Op.in]: (await Announcement.findAll({ where: announcementScopeWhere, attributes: ['id'] })).map(a => a.id) };
    }

    const attendanceRows = await Attendance.findAll({
      where: attendanceWhere,
      include: [
        { model: Beneficiary, attributes: ['id', 'first_name', 'last_name', 'category'], where: Object.keys(benWhere).length > 0 ? benWhere : undefined, required: Object.keys(benWhere).length > 0 },
        { model: Announcement, as: 'Announcement', attributes: ['id', 'title', 'event_date'], required: false },
      ],
      order: [['attendance_date', 'DESC'], ['createdAt', 'DESC']],
    });

    const absentWhere = { attendance_status: 'Absent' };
    if (Object.keys(announcementScopeWhere).length > 0) {
      absentWhere.announcement_id = { [Op.in]: (await Announcement.findAll({ where: announcementScopeWhere, attributes: ['id'] })).map(a => a.id) };
    }

    const absentRows = await AnnouncementRecipient.findAll({
      where: absentWhere,
      include: [
        { model: Beneficiary, as: 'Beneficiary', attributes: ['id', 'first_name', 'last_name', 'category'], where: Object.keys(benWhere).length > 0 ? benWhere : undefined, required: Object.keys(benWhere).length > 0 },
        { model: Announcement, attributes: ['id', 'title', 'event_date'], required: false },
      ],
      order: [['scanned_at', 'DESC'], ['id', 'DESC']],
    });

    const mapped = [
      ...attendanceRows.map(r => ({
        id: r.id,
        beneficiary_name: r.Beneficiary ? `${r.Beneficiary.first_name} ${r.Beneficiary.last_name}` : 'N/A',
        category: r.Beneficiary?.category || '—',
        event_name: r.event_name || r.Announcement?.title || 'N/A',
        attendance_date: r.attendance_date || r.Announcement?.event_date || null,
        time_in: r.time_in || '—',
        status: r.status,
        remarks: r.remarks || '—',
      })),
      ...absentRows.map(r => ({
        id: `a-${r.id}`,
        beneficiary_name: r.Beneficiary ? `${r.Beneficiary.first_name} ${r.Beneficiary.last_name}` : 'N/A',
        category: r.Beneficiary?.category || '—',
        event_name: r.Announcement?.title || 'N/A',
        attendance_date: r.Announcement?.event_date || null,
        time_in: '—',
        status: 'Absent',
        remarks: 'Marked absent',
      })),
    ].sort((a, b) => new Date(b.attendance_date || 0) - new Date(a.attendance_date || 0));

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginated = mapped.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: paginated,
      pagination: {
        total: mapped.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(mapped.length / parseInt(limit)) || 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// ── Audit Logs Table JSON (DSWD Admin only) ──
router.get('/table/audit-logs', authorize('admin'), async (req, res, next) => {
  try {
    const { page = 1, limit = 10, module: qModule, action: qAction } = req.query;

    const where = {};
    if (qModule) where.module = qModule;
    if (qAction) where.action = { [Op.like]: `%${qAction}%` };

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        { model: User, attributes: ['id', 'first_name', 'last_name', 'email', 'role'] },
      ],
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    const data = rows.map(log => ({
      id: log.id,
      user_name: log.User ? `${log.User.first_name} ${log.User.last_name}` : 'System',
      user_email: log.User?.email || '—',
      user_role: log.User?.role || '—',
      action: log.action,
      module: log.module,
      timestamp: log.timestamp,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)) || 1
      }
    });
  } catch (error) {
    next(error);
  }
});

// ── Export Assistance Requests as CSV ──
router.get('/export/assistance-requests', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { barangay_id: qBarangay, status: qStatus } = req.query;

    const where = {};
    if (isBarangayScoped && barangayId) where.barangay_id = barangayId;
    else if (qBarangay) where.barangay_id = qBarangay;
    if (isMswdoRole(req.user.role)) {
      where.agency = 'MSWDO';
    } else if (req.user.role === 'admin') {
      where.agency = 'DSWD';
    }
    if (qStatus) where.status = qStatus;

    const requests = await AssistanceRequest.findAll({
      where,
      include: [
        { model: Beneficiary, attributes: ['first_name', 'last_name', 'category'] },
        { model: Barangay, attributes: ['barangay_name'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const headers = ['ID', 'Beneficiary Name', 'Category', 'Type', 'Subject', 'Barangay', 'Status', 'Priority', 'Date Submitted'];
    const rows = requests.map(r => [
      r.id,
      r.Beneficiary ? `${r.Beneficiary.first_name} ${r.Beneficiary.last_name}` : '',
      r.Beneficiary?.category || '',
      r.type,
      r.subject,
      r.Barangay?.barangay_name || '',
      r.status,
      r.priority,
      r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US') : '',
    ]);

    const csv = toCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assistance-requests-report.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// ── Export Attendance as CSV ──
router.get('/export/attendance', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    const announcementScopeWhere = {};
    if (isMswdoRole(req.user.role)) {
      const mswdoAnnouncements = await Announcement.findAll({
        where: { created_by_user_id: req.user.id },
        attributes: ['id'],
      });
      announcementScopeWhere.id = { [Op.in]: mswdoAnnouncements.map(a => a.id) };
    }

    const benWhere = {};
    if (isBarangayScoped && barangayId) benWhere.barangay_id = barangayId;

    const attendanceWhere = {};
    if (Object.keys(announcementScopeWhere).length > 0) {
      attendanceWhere.announcement_id = { [Op.in]: (await Announcement.findAll({ where: announcementScopeWhere, attributes: ['id'] })).map(a => a.id) };
    }

    const records = await Attendance.findAll({
      where: attendanceWhere,
      include: [
        { model: Beneficiary, attributes: ['first_name', 'last_name', 'category'], where: Object.keys(benWhere).length > 0 ? benWhere : undefined, required: Object.keys(benWhere).length > 0 },
        { model: Announcement, as: 'Announcement', attributes: ['title', 'event_date'], required: false },
      ],
      order: [['attendance_date', 'DESC']],
    });

    const absentWhere = { attendance_status: 'Absent' };
    if (Object.keys(announcementScopeWhere).length > 0) {
      absentWhere.announcement_id = { [Op.in]: (await Announcement.findAll({ where: announcementScopeWhere, attributes: ['id'] })).map(a => a.id) };
    }

    const absentRecords = await AnnouncementRecipient.findAll({
      where: absentWhere,
      include: [
        { model: Beneficiary, as: 'Beneficiary', attributes: ['first_name', 'last_name', 'category'], where: Object.keys(benWhere).length > 0 ? benWhere : undefined, required: Object.keys(benWhere).length > 0 },
        { model: Announcement, attributes: ['title', 'event_date'], required: false },
      ],
      order: [['scanned_at', 'DESC']],
    });

    const rows = [
      ...records.map(r => [
        r.id,
        r.Beneficiary ? `${r.Beneficiary.first_name} ${r.Beneficiary.last_name}` : '',
        r.Beneficiary?.category || '',
        r.event_name || r.Announcement?.title || '',
        r.attendance_date || r.Announcement?.event_date || '',
        r.time_in || '',
        r.status,
        r.remarks || '',
      ]),
      ...absentRecords.map(r => [
        `a-${r.id}`,
        r.Beneficiary ? `${r.Beneficiary.first_name} ${r.Beneficiary.last_name}` : '',
        r.Beneficiary?.category || '',
        r.Announcement?.title || '',
        r.Announcement?.event_date || '',
        '',
        'Absent',
        'Marked absent',
      ])
    ];

    const headers = ['ID', 'Beneficiary Name', 'Category', 'Event Name', 'Date', 'Time In', 'Status', 'Remarks'];
    const csv = toCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// ── Export Audit Logs as CSV (DSWD Admin only) ──
router.get('/export/audit-logs', authorize('admin'), async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({
      include: [{ model: User, attributes: ['first_name', 'last_name', 'email', 'role'] }],
      order: [['timestamp', 'DESC']],
    });

    const headers = ['ID', 'User', 'Email', 'Role', 'Action', 'Module', 'Timestamp'];
    const rows = logs.map(log => [
      log.id,
      log.User ? `${log.User.first_name} ${log.User.last_name}` : 'System',
      log.User?.email || '',
      log.User?.role || '',
      log.action,
      log.module,
      log.timestamp ? new Date(log.timestamp).toLocaleString('en-US') : '',
    ]);

    const csv = toCSV(headers, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
