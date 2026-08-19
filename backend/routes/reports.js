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
      
      const pendingCount = await DistributionTransaction.count({
        where: { distribution_event_id: e.id, status: 'pending' }
      });
      
      // Get pending beneficiaries with names (limit to 5 for preview)
      const pendingTransactions = await DistributionTransaction.findAll({
        where: { distribution_event_id: e.id, status: 'pending' },
        include: [
          { 
            model: Beneficiary, 
            attributes: ['id', 'first_name', 'middle_name', 'last_name', 'beneficiary_id_code']
          }
        ],
        limit: 5,
        order: [['id', 'ASC']]
      });
      
      const pendingBeneficiaries = pendingTransactions.map(txn => ({
        id: txn.Beneficiary?.id,
        name: txn.Beneficiary ? 
          `${txn.Beneficiary.first_name} ${txn.Beneficiary.middle_name ? txn.Beneficiary.middle_name + ' ' : ''}${txn.Beneficiary.last_name}`.trim() 
          : 'Unknown',
        beneficiary_id: txn.Beneficiary?.beneficiary_id_code || null,
      }));
      
      const totalBeneficiaries = e.total_beneficiaries || 0;
      
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

// Export Beneficiary List as CSV
router.get('/export/beneficiaries', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { program_id, barangay_id: qBarangay, category } = req.query;

    const where = { status: 'Approved' };
    if (isBarangayScoped && barangayId) where.barangay_id = barangayId;
    else if (qBarangay) where.barangay_id = qBarangay;
    if (category) where.category = category;

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

// Export Program Summary as CSV
router.get('/export/programs', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;

    const programWhere = {};
    if (isBarangayScoped && barangayId) programWhere.barangay_id = barangayId;

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

// Export Enrollment Report as CSV
router.get('/export/enrollments', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { program_id } = req.query;

    const enrollWhere = { status: 'active' };
    const benWhere = { status: 'Approved' };
    if (isBarangayScoped && barangayId) benWhere.barangay_id = barangayId;
    if (program_id) enrollWhere.program_id = program_id;

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

// Beneficiaries table JSON
router.get('/table/beneficiaries', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { barangay_id: qBarangay, program_id, page = 1, limit = 10 } = req.query;

    const where = { status: 'Approved' };
    if (isBarangayScoped && barangayId) where.barangay_id = barangayId;
    else if (qBarangay) where.barangay_id = qBarangay;

    // Filter by program if specified
    if (program_id) {
      where.id = {
        [Op.in]: sequelize.literal(`(SELECT beneficiary_id FROM enrollments WHERE program_id = ${sequelize.escape(program_id)} AND status = 'active')`)
      };
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

// Programs table JSON
router.get('/table/programs', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { barangay_id: qBarangay, page = 1, limit = 10 } = req.query;

    const programWhere = { status: { [Op.ne]: 'archived' } };
    if (isBarangayScoped && barangayId) programWhere.barangay_id = barangayId;
    else if (qBarangay) programWhere.barangay_id = qBarangay;

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

// Enrollments table JSON
router.get('/table/enrollments', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const isBarangayScoped = req.user.role === 'staff' || req.user.role === 'barangay';
    const barangayId = req.user.barangay_id;
    const { program_id, barangay_id: qBarangay, page = 1, limit = 10 } = req.query;

    const enrollWhere = { status: 'active' };
    if (program_id) enrollWhere.program_id = program_id;

    const benWhere = { status: 'Approved' };
    if (isBarangayScoped && barangayId) benWhere.barangay_id = barangayId;
    else if (qBarangay) benWhere.barangay_id = qBarangay;

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

module.exports = router;


