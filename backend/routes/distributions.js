const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  DistributionEvent,
  DistributionTransaction,
  BenefitProgram,
  Barangay,
  Beneficiary,
  Enrollment,
  User,
  Notification,
  AuditLog,
  sequelize,
} = require('../db');

const router = express.Router();
router.use(authenticate);

// ── Middleware: Ensure staff can only access their assigned barangay ──
const restrictToAssignedBarangay = async (req, res, next) => {
  console.log('[RESTRICT_BARANGAY] Checking access for user:', req.user.role, req.user.id);
  
  if (req.user.role === 'admin') {
    console.log('[RESTRICT_BARANGAY] Admin - access granted');
    return next(); // Admins have full access
  }
  
  if (req.user.role === 'staff' || req.user.role === 'barangay') {
    const eventId = req.params.id;
    if (!eventId) {
      console.log('[RESTRICT_BARANGAY] No event ID - skipping check');
      return next();
    }
    
    console.log('[RESTRICT_BARANGAY] Checking event:', eventId);
    const event = await DistributionEvent.findByPk(eventId);
    if (!event) {
      console.error('[RESTRICT_BARANGAY] Event not found:', eventId);
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }
    
    console.log('[RESTRICT_BARANGAY] Event barangay:', event.barangay_id, 'Assigned staff:', event.assigned_staff_id);
    console.log('[RESTRICT_BARANGAY] User barangay:', req.user.barangay_id, 'User ID:', req.user.id);
    
    // Staff can only access events in their barangay OR assigned to them
    if (req.user.barangay_id !== event.barangay_id && req.user.id !== event.assigned_staff_id) {
      console.error('[RESTRICT_BARANGAY] Access denied - barangay mismatch and not assigned');
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only access distribution events assigned to your barangay.' 
      });
    }
    
    console.log('[RESTRICT_BARANGAY] Access granted');
  }
  
  next();
};

// ── Helper: generate transaction number ──
const generateTransactionNumber = (eventId, index) => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `TXN-${dateStr}-${String(eventId).padStart(4, '0')}-${String(index).padStart(4, '0')}`;
};

// ══════════════════════════════════════════════════
//  DISTRIBUTION EVENTS
// ══════════════════════════════════════════════════

// ── GET /events ── List distribution events
router.get('/events', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    const { checkAndProcessExpiredDistributions } = require('../utils/distributionScheduler');
    await checkAndProcessExpiredDistributions();
    const where = {};

    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      // STRICT: Staff sees ONLY events in their assigned barangay
      if (!req.user.barangay_id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account is not assigned to any barangay. Please contact the administrator.' 
        });
      }
      where.barangay_id = req.user.barangay_id;
    } else if (req.user.role === 'beneficiary') {
      // Beneficiary sees only events where they have a transaction
      const txns = await DistributionTransaction.findAll({
        include: [{ model: Beneficiary, where: { user_id: req.user.id } }],
        attributes: ['distribution_event_id'],
      });
      const eventIds = [...new Set(txns.map(t => t.distribution_event_id))];
      if (eventIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      where.id = eventIds;
    }

    // Apply status filter if provided
    if (req.query.status && req.query.status !== 'all') {
      where.status = req.query.status;
    }

    // Apply barangay filter if provided (admin only)
    if (req.query.barangay_id && req.query.barangay_id !== 'all' && req.user.role === 'admin') {
      where.barangay_id = parseInt(req.query.barangay_id);
    }

    const events = await DistributionEvent.findAll({
      where,
      include: [
        { model: BenefitProgram, as: 'Program', attributes: ['id', 'name', 'code', 'eligibility_category', 'benefit_type'] },
        { model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] },
        { model: User, as: 'AssignedStaff', attributes: ['id', 'first_name', 'last_name', 'email'] },
      ],
      order: [['distribution_date', 'DESC']],
    });
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
});

// ── GET /events/:id ── Get event details
router.get('/events/:id', authorize('admin', 'staff', 'barangay', 'beneficiary'), restrictToAssignedBarangay, async (req, res, next) => {
  try {
    const event = await DistributionEvent.findByPk(req.params.id, {
      include: [
        { model: BenefitProgram, as: 'Program' },
        { model: Barangay },
        { model: User, as: 'AssignedStaff', attributes: ['id', 'first_name', 'last_name', 'email'] },
        {
          model: DistributionTransaction,
          as: 'Transactions',
          include: [
            { model: Beneficiary, include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }] },
            { model: User, as: 'ReleasedByStaff', attributes: ['id', 'first_name', 'last_name'] },
          ],
        },
      ],
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }
    
    // Calculate real-time statistics
    const stats = {
      total_beneficiaries: event.total_beneficiaries,
      total_released: event.total_released,
      total_pending: event.total_beneficiaries - event.total_released,
      total_amount_allocated: parseFloat(event.budget),
      total_amount_released: parseFloat(event.total_amount_released),
      total_amount_remaining: parseFloat(event.budget) - parseFloat(event.total_amount_released),
      release_percentage: event.total_beneficiaries > 0 
        ? ((event.total_released / event.total_beneficiaries) * 100).toFixed(2) 
        : 0,
    };
    
    res.json({ success: true, data: { ...event.toJSON(), stats } });
  } catch (error) {
    next(error);
  }
});

// ── GET /events/:id/eligible-beneficiaries ── Load beneficiaries for a barangay with eligibility info
router.get('/events/:id/eligible-beneficiaries', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const { program_id, barangay_id, target_category } = req.query;
    if (!program_id || !barangay_id) {
      return res.status(400).json({ success: false, message: 'program_id and barangay_id are required' });
    }

    const program = await BenefitProgram.findByPk(program_id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    // Step 1: Fetch ALL approved beneficiaries in the selected barangay
    // Optionally filtered by target_category if provided
    const beneficiaryWhere = {
      barangay_id,
      status: 'Approved',
    };

    if (target_category) {
      beneficiaryWhere.category = { [Op.like]: `%${target_category}%` };
    }

    const allBeneficiaries = await Beneficiary.findAll({
      where: beneficiaryWhere,
      include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
      order: [['last_name', 'ASC'], ['first_name', 'ASC']],
    });

    // Step 2: Get all active enrollments for this program in this barangay
    const enrollments = await Enrollment.findAll({
      where: { program_id, status: 'active' },
      include: [{
        model: Beneficiary,
        where: { barangay_id },
        attributes: ['id'],
      }],
    });

    // Build a set of enrolled beneficiary IDs for fast lookup
    const enrolledIds = new Set(enrollments.map(e => e.beneficiary_id));

    // Step 3: Map beneficiaries with enrollment/qualification status
    const beneficiaries = allBeneficiaries.map(b => {
      const isEnrolled = enrolledIds.has(b.id);

      // Category match check (for target_category filter)
      const categoryMatch = !target_category || (b.category && b.category.includes(target_category));

      // Program eligibility category check
      const programCategoryMatch = !program.eligibility_category ||
        (b.category && b.category.includes(program.eligibility_category));

      return {
        beneficiary_id: b.id,
        first_name: b.first_name,
        last_name: b.last_name,
        middle_name: b.middle_name,
        category: b.category,
        RFID_number: b.RFID_number,
        beneficiary_id_code: b.beneficiary_id_code,
        contact_number: b.contact_number,
        profile_photo: b.profile_photo,
        barangay: b.Barangay,
        status: b.status,
        // Qualification flags
        is_enrolled: isEnrolled,
        category_match: categoryMatch && programCategoryMatch,
        // Fully qualified = enrolled AND category matches
        is_qualified: isEnrolled && categoryMatch && programCategoryMatch,
        disqualify_reason: !isEnrolled
          ? 'Not enrolled in this program'
          : (!categoryMatch || !programCategoryMatch)
          ? 'Category does not match'
          : null,
      };
    });

    const qualifiedCount = beneficiaries.filter(b => b.is_qualified).length;

    res.json({
      success: true,
      data: beneficiaries,
      total: beneficiaries.length,
      qualified_count: qualifiedCount,
      program_name: program.name,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /events/:id/count-eligible ── Count eligible beneficiaries for a draft event
// This allows staff to preview how many beneficiaries will be included BEFORE publishing
router.get('/events/:id/count-eligible', authorize('admin', 'staff', 'barangay'), restrictToAssignedBarangay, async (req, res, next) => {
  try {
    const event = await DistributionEvent.findByPk(req.params.id, {
      include: [{ model: BenefitProgram, as: 'Program' }],
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }

    const program = event.Program;
    const beneficiaryWhere = {
      barangay_id: event.barangay_id,
      status: 'Approved',
    };

    // Apply category filtering:
    // 1. If event has target_category, use it (distribution-specific filter)
    // 2. Otherwise, if program has eligibility_category, use that (program-wide filter)
    if (event.target_category) {
      beneficiaryWhere.category = { [Op.like]: `%${event.target_category}%` };
    } else if (program && program.eligibility_category) {
      beneficiaryWhere.category = { [Op.like]: `%${program.eligibility_category}%` };
    }

    // Get eligible beneficiaries based on program enrollment
    const enrollments = await Enrollment.findAll({
      where: { program_id: event.program_id, status: 'active' },
      include: [{ model: Beneficiary, where: beneficiaryWhere }],
    });

    const eligibleCount = enrollments.length;
    const amountPerBeneficiary = parseFloat(event.amount_per_beneficiary);
    const totalRequired = amountPerBeneficiary * eligibleCount;
    const availableBudget = parseFloat(event.budget);
    const budgetSufficient = totalRequired <= availableBudget;

    res.json({
      success: true,
      data: {
        event_id: event.id,
        program_name: program.name,
        eligible_count: eligibleCount,
        amount_per_beneficiary: amountPerBeneficiary,
        total_required: totalRequired,
        available_budget: availableBudget,
        budget_sufficient: budgetSufficient,
        budget_deficit: budgetSufficient ? 0 : totalRequired - availableBudget,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /events ── Create a distribution event (Admin only)
router.post('/events', authorize('admin'), async (req, res, next) => {
  try {
    console.log('[CREATE EVENT] Request body:', req.body);
    console.log('[CREATE EVENT] User:', req.user.role, req.user.id);
    
    // Validate required fields
    const { title, program_id, barangay_id, distribution_date, budget, amount_per_beneficiary } = req.body;
    
    const missingFields = [];
    if (!title) missingFields.push('title');
    if (!program_id) missingFields.push('program_id');
    if (!barangay_id) missingFields.push('barangay_id');
    if (!distribution_date) missingFields.push('distribution_date');
    if (!budget) missingFields.push('budget');
    if (!amount_per_beneficiary) missingFields.push('amount_per_beneficiary');
    
    if (missingFields.length > 0) {
      console.error('[CREATE EVENT] Missing required fields:', missingFields);
      return res.status(400).json({ 
        success: false, 
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missing_fields: missingFields,
      });
    }
    
    // Validate that program exists
    const program = await BenefitProgram.findByPk(program_id);
    if (!program) {
      console.error('[CREATE EVENT] Program not found:', program_id);
      return res.status(404).json({ 
        success: false, 
        message: `Program with ID ${program_id} not found`,
      });
    }
    
    // Validate that barangay exists
    const barangay = await Barangay.findByPk(barangay_id);
    if (!barangay) {
      console.error('[CREATE EVENT] Barangay not found:', barangay_id);
      return res.status(404).json({ 
        success: false, 
        message: `Barangay with ID ${barangay_id} not found`,
      });
    }
    
    // Validate numeric fields
    if (isNaN(parseFloat(budget)) || parseFloat(budget) <= 0) {
      console.error('[CREATE EVENT] Invalid budget:', budget);
      return res.status(400).json({ 
        success: false, 
        message: 'Budget must be a positive number',
      });
    }
    
    if (isNaN(parseFloat(amount_per_beneficiary)) || parseFloat(amount_per_beneficiary) <= 0) {
      console.error('[CREATE EVENT] Invalid amount_per_beneficiary:', amount_per_beneficiary);
      return res.status(400).json({ 
        success: false, 
        message: 'Amount per beneficiary must be a positive number',
      });
    }
    
    // Validate date
    const distDate = new Date(distribution_date);
    if (isNaN(distDate.getTime())) {
      console.error('[CREATE EVENT] Invalid date:', distribution_date);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid distribution date format',
      });
    }
    
    console.log('[CREATE EVENT] Validation passed, creating event...');
    
    const event = await DistributionEvent.create({
      ...req.body,
      status: 'draft',
      total_beneficiaries: 0,
      total_released: 0,
      total_amount_released: 0,
    });

    console.log('[CREATE EVENT] Event created:', event.id);

    const result = await DistributionEvent.findByPk(event.id, {
      include: [
        { model: BenefitProgram, as: 'Program', attributes: ['id', 'name', 'code'] },
        { model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] },
        { model: User, as: 'AssignedStaff', attributes: ['id', 'first_name', 'last_name'] },
      ],
    });

    await AuditLog.create({
      user_id: req.user.id,
      action: `Created distribution event: ${event.title}`,
      module: 'distributions',
    });

    console.log('[CREATE EVENT] Success!');
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('[CREATE EVENT] Error:', error.message);
    console.error('[CREATE EVENT] Error stack:', error.stack);
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error: ' + error.message,
        errors: error.errors?.map(e => ({ field: e.path, message: e.message })),
      });
    }
    next(error);
  }
});

// ── PUT /events/:id ── Update a distribution event (Admin only)
router.put('/events/:id', authorize('admin'), async (req, res, next) => {
  try {
    const event = await DistributionEvent.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }
    if (event.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft events can be edited' });
    }
    await event.update(req.body);

    const result = await DistributionEvent.findByPk(event.id, {
      include: [
        { model: BenefitProgram, as: 'Program', attributes: ['id', 'name', 'code'] },
        { model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] },
        { model: User, as: 'AssignedStaff', attributes: ['id', 'first_name', 'last_name'] },
      ],
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ── POST /events/:id/publish ── Publish a distribution event (Admin only)
// Validates budget, generates transactions, notifies staff & beneficiaries
router.post('/events/:id/publish', authorize('admin'), async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('[PUBLISH EVENT] Request for event ID:', req.params.id);
    console.log('[PUBLISH EVENT] User:', req.user.role, req.user.id);
    
    const event = await DistributionEvent.findByPk(req.params.id, {
      include: [{ model: BenefitProgram, as: 'Program' }],
      transaction,
    });
    
    if (!event) {
      console.error('[PUBLISH EVENT] Event not found:', req.params.id);
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }
    
    console.log('[PUBLISH EVENT] Event found:', {
      id: event.id,
      title: event.title,
      status: event.status,
      program_id: event.program_id,
      barangay_id: event.barangay_id,
      assigned_staff_id: event.assigned_staff_id,
      budget: event.budget,
      amount_per_beneficiary: event.amount_per_beneficiary,
      target_category: event.target_category,
    });
    
    if (event.status !== 'draft') {
      console.error('[PUBLISH EVENT] Event is not draft, current status:', event.status);
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Only draft events can be published' });
    }

    // Staff validation - MUST assign staff before publishing
    if (!event.assigned_staff_id) {
      console.error('[PUBLISH EVENT] No staff assigned');
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Please assign a Barangay Staff member before publishing this distribution event.' 
      });
    }

    console.log('[PUBLISH EVENT] Staff assigned:', event.assigned_staff_id);

    // Load eligible beneficiaries automatically based on program and barangay
    const program = event.Program;
    console.log('[PUBLISH EVENT] Program:', {
      id: program?.id,
      name: program?.name,
      eligibility_category: program?.eligibility_category,
    });
    
    const enrollmentWhere = { program_id: event.program_id, status: 'active' };
    const beneficiaryWhere = {
      barangay_id: event.barangay_id,
      status: 'Approved',
    };
    
    // Apply category filtering:
    // 1. If event has target_category, use it (distribution-specific filter)
    // 2. Otherwise, if program has eligibility_category, use that (program-wide filter)
    if (event.target_category) {
      beneficiaryWhere.category = { [Op.like]: `%${event.target_category}%` };
      console.log('[PUBLISH EVENT] Using event target_category filter:', event.target_category);
    } else if (program && program.eligibility_category) {
      beneficiaryWhere.category = { [Op.like]: `%${program.eligibility_category}%` };
      console.log('[PUBLISH EVENT] Using program eligibility_category filter:', program.eligibility_category);
    }

    console.log('[PUBLISH EVENT] Querying enrollments with:', {
      enrollmentWhere,
      beneficiaryWhere,
    });

    const enrollments = await Enrollment.findAll({
      where: enrollmentWhere,
      include: [{ model: Beneficiary, where: beneficiaryWhere }],
      transaction,
    });

    console.log('[PUBLISH EVENT] Found enrollments:', enrollments.length);

    if (enrollments.length === 0) {
      console.error('[PUBLISH EVENT] No eligible beneficiaries found');
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'No eligible beneficiaries found for this event. Please check program enrollment and beneficiary approval status.',
        debug: {
          program_id: event.program_id,
          barangay_id: event.barangay_id,
          target_category: event.target_category,
          program_eligibility: program?.eligibility_category,
        }
      });
    }

    // Calculate budget requirements
    const eligibleCount = enrollments.length;
    const amountPerBeneficiary = parseFloat(event.amount_per_beneficiary);
    const totalRequired = amountPerBeneficiary * eligibleCount;
    const availableBudget = parseFloat(event.budget);

    console.log('[PUBLISH EVENT] Budget calculation:', {
      eligibleCount,
      amountPerBeneficiary,
      totalRequired,
      availableBudget,
      sufficient: totalRequired <= availableBudget,
    });

    // STRICT BUDGET VALIDATION
    if (totalRequired > availableBudget) {
      console.error('[PUBLISH EVENT] Insufficient budget');
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Insufficient Budget',
        error_code: 'INSUFFICIENT_BUDGET',
        details: {
          eligible_beneficiaries: eligibleCount,
          amount_per_beneficiary: amountPerBeneficiary,
          total_required: totalRequired.toFixed(2),
          available_budget: availableBudget.toFixed(2),
          deficit: (totalRequired - availableBudget).toFixed(2),
          message: `You need ₱${(totalRequired - availableBudget).toLocaleString('en-PH', { minimumFractionDigits: 2 })} more to publish this distribution.`,
        },
      });
    }

    // Generate unique transaction numbers for each beneficiary
    const transactions = enrollments.map((enrollment, index) => ({
      transaction_number: generateTransactionNumber(event.id, index + 1),
      distribution_event_id: event.id,
      beneficiary_id: enrollment.Beneficiary.id,
      amount: event.amount_per_beneficiary,
      status: 'pending',
    }));

    // Create distribution batch
    await DistributionTransaction.bulkCreate(transactions, { transaction });

    // Update event status
    await event.update({
      status: 'scheduled',
      total_beneficiaries: eligibleCount,
      published_at: new Date(),
    }, { transaction });

    // ── Notify assigned staff ──
    const assignedStaff = await User.findByPk(event.assigned_staff_id);
    if (assignedStaff) {
      await Notification.create({
        user_id: event.assigned_staff_id,
        title: 'New Distribution Event Assigned',
        message: `You have been assigned to conduct "${event.title}" scheduled for ${event.distribution_date} at ${event.venue || 'the designated venue'}. ${eligibleCount} beneficiaries are enrolled.`,
        type: 'distribution',
        reference_id: event.id,
        reference_type: 'DistributionEvent',
        is_read: false,
      }, { transaction });
    }

    // ── Notify all eligible beneficiaries ──
    const notificationPromises = enrollments.map(async (enrollment) => {
      if (enrollment.Beneficiary.user_id) {
        return Notification.create({
          user_id: enrollment.Beneficiary.user_id,
          title: 'Upcoming Benefit Distribution',
          message: `You are scheduled to receive ₱${parseFloat(event.amount_per_beneficiary).toLocaleString('en-PH', { minimumFractionDigits: 2 })} from "${program.name}" on ${event.distribution_date} at ${event.venue || 'the designated venue'}. Please bring a valid ID for verification.`,
          type: 'distribution',
          reference_id: event.id,
          reference_type: 'DistributionEvent',
          is_read: false,
        }, { transaction });
      }
    });
    
    await Promise.all(notificationPromises);

    // Create audit log
    await AuditLog.create({
      user_id: req.user.id,
      action: `Published distribution event: ${event.title} with ${eligibleCount} beneficiaries (₱${totalRequired.toLocaleString('en-PH', { minimumFractionDigits: 2 })} total)`,
      module: 'distributions',
      details: JSON.stringify({
        event_id: event.id,
        program_id: event.program_id,
        barangay_id: event.barangay_id,
        eligible_count: eligibleCount,
        total_budget: totalRequired,
      }),
    }, { transaction });

    await transaction.commit();
    
    console.log('[PUBLISH EVENT] Transaction committed successfully');

    // Reload event with associations
    const result = await DistributionEvent.findByPk(event.id, {
      include: [
        { model: BenefitProgram, as: 'Program', attributes: ['id', 'name', 'code'] },
        { model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] },
        { model: User, as: 'AssignedStaff', attributes: ['id', 'first_name', 'last_name'] },
      ],
    });

    console.log('[PUBLISH EVENT] Success! Published event:', {
      id: result.id,
      title: result.title,
      status: result.status,
      total_beneficiaries: result.total_beneficiaries,
    });

    res.json({ 
      success: true, 
      data: result, 
      message: `Distribution event published successfully! ${eligibleCount} beneficiaries will be notified.`,
      summary: {
        total_beneficiaries: eligibleCount,
        total_budget_allocated: totalRequired.toFixed(2),
        amount_per_beneficiary: amountPerBeneficiary.toFixed(2),
      }
    });
  } catch (error) {
    console.error('[PUBLISH EVENT] Error:', error.message);
    console.error('[PUBLISH EVENT] Error stack:', error.stack);
    await transaction.rollback();
    next(error);
  }
});

// ── PATCH /events/:id/status ── Transition event status
router.patch('/events/:id/status', authorize('admin', 'staff', 'barangay'), restrictToAssignedBarangay, async (req, res, next) => {
  try {
    const event = await DistributionEvent.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }

    const { status } = req.body;
    const validTransitions = {
      draft: ['scheduled'],
      scheduled: ['ongoing'],
      ongoing: ['completed'],
      completed: ['archived'],
    };

    if (!validTransitions[event.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${event.status}" to "${status}"`,
      });
    }

    const updateData = { status };
    if (status === 'ongoing') {
      updateData.started_at = new Date();
    }
    if (status === 'completed') {
      updateData.completed_at = new Date();
    }

    await event.update(updateData);

    await AuditLog.create({
      user_id: req.user.id,
      action: `Changed distribution event "${event.title}" status to ${status}`,
      module: 'distributions',
      details: JSON.stringify({ event_id: event.id, old_status: event.status, new_status: status }),
    });

    res.json({ success: true, data: event, message: `Distribution event status updated to ${status}` });
  } catch (error) {
    next(error);
  }
});

// ── POST /events/:id/start-session ── Start distribution session (Staff only)
router.post('/events/:id/start-session', authorize('admin', 'staff', 'barangay'), restrictToAssignedBarangay, async (req, res, next) => {
  try {
    const event = await DistributionEvent.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }

    if (event.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'This distribution session has been ended and cannot be restarted.' 
      });
    }

    if (event.status !== 'scheduled' && event.status !== 'ongoing') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only scheduled events can start a distribution session' 
      });
    }

    // Transition to ongoing if scheduled
    if (event.status === 'scheduled') {
      await event.update({ 
        status: 'ongoing',
        started_at: new Date(),
      });
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: `Started distribution session for "${event.title}"`,
      module: 'distributions',
      details: JSON.stringify({ event_id: event.id }),
    });

    // Reload event to ensure we return the updated status
    await event.reload();

    res.json({ 
      success: true, 
      data: event,
      message: 'Distribution session started. You can now begin verifying and releasing benefits.',
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /events/:id/end-session ── End distribution session (Staff only)
router.post('/events/:id/end-session', authorize('admin', 'staff', 'barangay'), restrictToAssignedBarangay, async (req, res, next) => {
  try {
    const event = await DistributionEvent.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }

    if (event.status !== 'ongoing') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only ongoing distribution sessions can be ended' 
      });
    }

    // Check transactions status
    const pendingTransactions = await DistributionTransaction.findAll({
      where: { distribution_event_id: event.id, status: 'pending' },
      include: [{ model: Beneficiary, attributes: ['id', 'user_id', 'first_name', 'last_name', 'contact_number'] }],
    });

    const pendingCount = pendingTransactions.length;

    const releasedCount = await DistributionTransaction.count({
      where: { distribution_event_id: event.id, status: 'released' },
    });

    // Once a distribution session ends, set status to completed permanently
    await event.update({ 
      status: 'completed',
      completed_at: new Date(),
    });

    // Mark previous "Upcoming Benefit Distribution" notifications for this event as read
    await Notification.update(
      { is_read: true },
      {
        where: {
          reference_id: event.id,
          title: { [Op.like]: '%Upcoming%' },
          is_read: false,
        },
      }
    );

    // Create popup notifications for unclaimed beneficiaries
    let notifiedCount = 0;
    const notifPromises = pendingTransactions
      .filter(txn => txn.Beneficiary && txn.Beneficiary.user_id)
      .map(txn => {
        notifiedCount++;
        const amountStr = parseFloat(txn.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
        return Notification.create({
          user_id: txn.Beneficiary.user_id,
          title: `Unclaimed Benefit Notice: ${event.title}`,
          message: `Dear ${txn.Beneficiary.first_name}, you have an unclaimed benefit of ₱${amountStr} for "${event.title}". The distribution session has ended. Please visit your Barangay office or contact staff for assistance.`,
          type: 'distribution',
          reference_id: event.id,
          reference_type: 'distribution_event',
          is_read: false,
        });
      });

    await Promise.all(notifPromises);

    await AuditLog.create({
      user_id: req.user.id,
      action: `Ended distribution session for "${event.title}" - ${releasedCount} released, ${pendingCount} pending (${notifiedCount} notifications sent)`,
      module: 'distributions',
      details: JSON.stringify({ event_id: event.id, released: releasedCount, pending: pendingCount, notifications_sent: notifiedCount }),
    });

    res.json({ 
      success: true, 
      data: event,
      message: pendingCount === 0 
        ? 'Distribution session completed. All benefits have been released!' 
        : `Distribution session ended and locked. ${pendingCount} beneficiary(ies) did not claim and have been notified.`,
      summary: {
        released: releasedCount,
        pending: pendingCount,
        status: 'completed',
        notifications_sent: notifiedCount,
      }
    });
  } catch (error) {
    next(error);
  }
});

// ══════════════════════════════════════════════════
//  DISTRIBUTION TRANSACTIONS
// ══════════════════════════════════════════════════

// ── GET /events/:id/transactions ── List transactions for an event
router.get('/events/:id/transactions', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    const where = { distribution_event_id: req.params.id };

    // Beneficiaries can only see their own transactions
    if (req.user.role === 'beneficiary') {
      const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (!beneficiary) return res.json({ success: true, data: [] });
      where.beneficiary_id = beneficiary.id;
    }

    const transactions = await DistributionTransaction.findAll({
      where,
      include: [
        {
          model: Beneficiary,
          attributes: ['id', 'first_name', 'last_name', 'middle_name', 'category', 'RFID_number', 'beneficiary_id_code', 'profile_photo', 'contact_number'],
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
        },
        { model: User, as: 'ReleasedByStaff', attributes: ['id', 'first_name', 'last_name'] },
      ],
      order: [['created_at', 'ASC']],
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
});

// ── POST /events/:id/transactions/:txnId/verify ── Verify a beneficiary
router.post('/events/:id/transactions/:txnId/verify', authorize('admin', 'staff', 'barangay'), restrictToAssignedBarangay, async (req, res, next) => {
  try {
    const txn = await DistributionTransaction.findOne({
      where: { id: req.params.txnId, distribution_event_id: req.params.id },
      include: [
        {
          model: Beneficiary,
          include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
        },
        { 
          model: DistributionEvent, 
          as: 'Event', 
          include: [
            { model: BenefitProgram, as: 'Program' },
            { model: Barangay, attributes: ['id', 'barangay_name'] }
          ] 
        },
      ],
    });

    if (!txn) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found in this distribution event',
        verified: false,
      });
    }

    // AUTOMATIC VALIDATION CHECKS
    const checks = {
      beneficiary_registered: !!txn.Beneficiary,
      beneficiary_approved: txn.Beneficiary?.status === 'Approved',
      correct_barangay: txn.Beneficiary?.barangay_id === txn.Event?.barangay_id,
      not_yet_claimed: txn.status === 'pending',
      event_is_active: txn.Event?.status === 'ongoing',
      included_in_batch: !!txn.id,
    };

    // Check if already released
    if (txn.status === 'released') {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Benefit Already Claimed',
        error_code: 'ALREADY_CLAIMED',
        data: {
          beneficiary_name: `${txn.Beneficiary.first_name} ${txn.Beneficiary.middle_name || ''} ${txn.Beneficiary.last_name}`.trim(),
          transaction_number: txn.transaction_number,
          released_at: txn.released_at,
          amount: txn.amount,
        },
      });
    }

    // Check if beneficiary belongs to correct barangay
    if (!checks.correct_barangay) {
      return res.status(403).json({
        success: false,
        verified: false,
        message: 'Barangay Mismatch',
        error_code: 'WRONG_BARANGAY',
        details: {
          beneficiary_barangay: txn.Beneficiary?.Barangay?.barangay_name,
          event_barangay: txn.Event?.Barangay?.barangay_name,
        },
      });
    }

    // Check if event is ongoing
    if (!checks.event_is_active) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Distribution Session Not Active',
        error_code: 'SESSION_NOT_ACTIVE',
        details: {
          event_status: txn.Event?.status,
          message: 'Please start the distribution session first.',
        },
      });
    }

    const allValid = Object.values(checks).every(Boolean);

    res.json({
      success: true,
      verified: allValid,
      checks,
      data: {
        transaction_id: txn.id,
        transaction_number: txn.transaction_number,
        beneficiary_id: txn.Beneficiary.id,
        beneficiary_name: `${txn.Beneficiary.first_name} ${txn.Beneficiary.middle_name || ''} ${txn.Beneficiary.last_name}`.trim(),
        beneficiary_id_code: txn.Beneficiary.beneficiary_id_code,
        profile_photo: txn.Beneficiary.profile_photo,
        program_name: txn.Event?.Program?.name,
        amount: parseFloat(txn.amount),
        formatted_amount: `₱${parseFloat(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        barangay: txn.Beneficiary.Barangay?.barangay_name,
        status: txn.status,
        category: txn.Beneficiary.category,
        RFID_number: txn.Beneficiary.RFID_number,
        contact_number: txn.Beneficiary.contact_number,
        distribution_date: txn.Event?.distribution_date,
        venue: txn.Event?.venue,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /events/:id/transactions/:txnId/release ── Release benefit
router.post('/events/:id/transactions/:txnId/release', authorize('admin', 'staff', 'barangay'), restrictToAssignedBarangay, async (req, res, next) => {
  const dbTransaction = await sequelize.transaction();
  
  try {
    console.log('[RELEASE BENEFIT] Request from user:', req.user.role, req.user.id);
    console.log('[RELEASE BENEFIT] Event ID:', req.params.id, 'Transaction ID:', req.params.txnId);
    
    const txn = await DistributionTransaction.findOne({
      where: { id: req.params.txnId, distribution_event_id: req.params.id },
      include: [
        { model: Beneficiary },
        { model: DistributionEvent, as: 'Event' }
      ],
      transaction: dbTransaction,
      lock: true, // Prevent duplicate releases
    });

    if (!txn) {
      console.error('[RELEASE BENEFIT] Transaction not found');
      await dbTransaction.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    console.log('[RELEASE BENEFIT] Transaction found:', {
      id: txn.id,
      status: txn.status,
      beneficiary: `${txn.Beneficiary?.first_name} ${txn.Beneficiary?.last_name}`,
      amount: txn.amount,
    });

    // Prevent duplicate release
    if (txn.status === 'released') {
      console.error('[RELEASE BENEFIT] Already released');
      await dbTransaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Benefit already released for this transaction',
        error_code: 'ALREADY_RELEASED',
        details: {
          released_at: txn.released_at,
          transaction_number: txn.transaction_number,
        }
      });
    }

    // Verify event is ongoing
    if (txn.Event.status !== 'ongoing') {
      console.error('[RELEASE BENEFIT] Event not ongoing, status:', txn.Event.status);
      await dbTransaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Distribution session is not active. Please start the session first.',
        error_code: 'SESSION_NOT_ACTIVE',
      });
    }

    const { signature_data, photo_proof, verification_method, notes } = req.body;

    console.log('[RELEASE BENEFIT] Request body:', {
      has_signature: !!signature_data,
      has_photo: !!photo_proof,
      verification_method,
    });

    // Validate signature or photo proof is provided
    if (!signature_data && !photo_proof) {
      console.error('[RELEASE BENEFIT] No signature or photo proof provided');
      await dbTransaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide either a digital signature or photo proof of receipt' 
      });
    }

    console.log('[RELEASE BENEFIT] Updating transaction status to released...');

    // Update transaction status
    await txn.update({
      status: 'released',
      released_at: new Date(),
      released_by_staff_id: req.user.id,
      signature_data: signature_data || null,
      photo_proof: photo_proof || null,
      verification_method: verification_method || 'manual',
      notes: notes || null,
    }, { transaction: dbTransaction });

    console.log('[RELEASE BENEFIT] Updating event counters...');

    // Update event counters
    const event = txn.Event;
    const releasedCount = await DistributionTransaction.count({
      where: { distribution_event_id: event.id, status: 'released' },
      transaction: dbTransaction,
    });
    const releasedAmount = await DistributionTransaction.sum('amount', {
      where: { distribution_event_id: event.id, status: 'released' },
      transaction: dbTransaction,
    }) || 0;

    await event.update({
      total_released: releasedCount,
      total_amount_released: releasedAmount,
    }, { transaction: dbTransaction });

    console.log('[RELEASE BENEFIT] Event counters updated:', {
      total_released: releasedCount,
      total_amount_released: releasedAmount,
    });

    // AUTO-COMPLETE: If all beneficiaries have received their benefits, mark event as completed
    const totalBeneficiaries = event.total_beneficiaries;
    if (releasedCount >= totalBeneficiaries && totalBeneficiaries > 0) {
      console.log('[RELEASE BENEFIT] All benefits released! Auto-completing event...');
      await event.update({
        status: 'completed',
        completed_at: new Date(),
      }, { transaction: dbTransaction });
      
      console.log('[RELEASE BENEFIT] Event auto-completed:', {
        event_id: event.id,
        title: event.title,
        total_beneficiaries: totalBeneficiaries,
        total_released: releasedCount,
      });

      // Create audit log for completion
      await AuditLog.create({
        user_id: req.user.id,
        action: `Distribution event "${event.title}" auto-completed - all ${totalBeneficiaries} beneficiaries received benefits`,
        module: 'distributions',
        details: JSON.stringify({
          event_id: event.id,
          total_beneficiaries: totalBeneficiaries,
          total_released: releasedCount,
          total_amount_released: releasedAmount,
          auto_completed: true,
        }),
      }, { transaction: dbTransaction });

      // AUTO-COMPLETE PROGRAM: Mark the program as completed as well
      console.log('[RELEASE BENEFIT] Auto-completing program...');
      const program = await BenefitProgram.findByPk(event.program_id, { transaction: dbTransaction });
      if (program && program.status === 'active') {
        await program.update({
          status: 'completed',
        }, { transaction: dbTransaction });

        console.log('[RELEASE BENEFIT] Program auto-completed:', {
          program_id: program.id,
          program_name: program.name,
        });

        // Create audit log for program completion
        await AuditLog.create({
          user_id: req.user.id,
          action: `Program "${program.name}" auto-completed - distribution event finished`,
          module: 'programs',
          details: JSON.stringify({
            program_id: program.id,
            event_id: event.id,
            auto_completed: true,
          }),
        }, { transaction: dbTransaction });
      }
    }

    // Notify beneficiary
    const beneficiary = txn.Beneficiary;
    if (beneficiary?.user_id) {
      await Notification.create({
        user_id: beneficiary.user_id,
        title: 'Benefit Successfully Released',
        message: `Your benefit of ₱${parseFloat(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} has been successfully released. Transaction Number: ${txn.transaction_number}. You can now view and download your receipt.`,
        type: 'distribution',
        reference_id: txn.id,
        reference_type: 'DistributionTransaction',
        is_read: false,
      }, { transaction: dbTransaction });
    }

    // Create audit log
    await AuditLog.create({
      user_id: req.user.id,
      action: `Released benefit ₱${parseFloat(txn.amount).toFixed(2)} to ${beneficiary.first_name} ${beneficiary.last_name} (TXN: ${txn.transaction_number})`,
      module: 'distributions',
      details: JSON.stringify({
        transaction_id: txn.id,
        beneficiary_id: beneficiary.id,
        amount: parseFloat(txn.amount),
        verification_method,
        event_id: event.id,
      }),
    }, { transaction: dbTransaction });

    await dbTransaction.commit();

    // Reload with associations
    const result = await DistributionTransaction.findByPk(txn.id, {
      include: [
        { model: Beneficiary, include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }] },
        { model: User, as: 'ReleasedByStaff', attributes: ['id', 'first_name', 'last_name'] },
        { model: DistributionEvent, as: 'Event', include: [{ model: BenefitProgram, as: 'Program' }] },
      ],
    });

    res.json({ 
      success: true, 
      data: result, 
      message: 'Benefit released successfully! Receipt can now be generated.',
      receipt_available: true,
    });
  } catch (error) {
    await dbTransaction.rollback();
    next(error);
  }
});

// ── GET /events/:id/receipt/:txnId ── Get receipt data
router.get('/events/:id/receipt/:txnId', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    const txn = await DistributionTransaction.findOne({
      where: { id: req.params.txnId, distribution_event_id: req.params.id },
      include: [
        {
          model: Beneficiary,
          include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
        },
        {
          model: DistributionEvent,
          as: 'Event',
          include: [
            { model: BenefitProgram, as: 'Program' },
            { model: Barangay, attributes: ['id', 'barangay_name'] },
          ],
        },
        { model: User, as: 'ReleasedByStaff', attributes: ['id', 'first_name', 'last_name', 'email'] },
      ],
    });

    if (!txn) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    // Beneficiaries can only view their own receipts
    if (req.user.role === 'beneficiary') {
      if (txn.Beneficiary.user_id !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only view your own receipts' 
        });
      }
    }

    // Only released transactions have receipts
    if (txn.status !== 'released') {
      return res.status(400).json({
        success: false,
        message: 'Receipt not available. Benefit has not been released yet.',
        transaction_status: txn.status,
      });
    }

    res.json({
      success: true,
      data: {
        // Transaction Details
        transaction_number: txn.transaction_number,
        status: txn.status,
        released_at: txn.released_at,
        verification_method: txn.verification_method,
        
        // Beneficiary Details
        beneficiary_id: txn.Beneficiary.id,
        beneficiary_name: `${txn.Beneficiary.first_name} ${txn.Beneficiary.middle_name || ''} ${txn.Beneficiary.last_name}`.trim(),
        beneficiary_id_code: txn.Beneficiary.beneficiary_id_code,
        beneficiary_barangay: txn.Beneficiary.Barangay?.barangay_name,
        beneficiary_address: txn.Beneficiary.address,
        beneficiary_contact: txn.Beneficiary.contact_number,
        
        // Program & Event Details
        program_name: txn.Event?.Program?.name,
        program_code: txn.Event?.Program?.code,
        event_title: txn.Event?.title,
        event_barangay: txn.Event?.Barangay?.barangay_name,
        distribution_date: txn.Event?.distribution_date,
        venue: txn.Event?.venue,
        
        // Amount Details
        amount: parseFloat(txn.amount),
        formatted_amount: `₱${parseFloat(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        amount_in_words: numberToWords(parseFloat(txn.amount)),
        
        // Staff Details
        released_by: txn.ReleasedByStaff ? `${txn.ReleasedByStaff.first_name} ${txn.ReleasedByStaff.last_name}` : 'N/A',
        released_by_email: txn.ReleasedByStaff?.email,
        
        // Proof Details
        signature_available: !!txn.signature_data,
        photo_proof_available: !!txn.photo_proof,
        
        // Receipt Metadata
        receipt_generated_at: new Date().toISOString(),
        receipt_type: 'Official Distribution Receipt',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to convert number to words (for receipt)
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero Pesos';

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let words = '';

  if (intPart >= 1000000) {
    words += ones[Math.floor(intPart / 1000000)] + ' Million ';
    intPart %= 1000000;
  }

  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    if (thousands >= 100) {
      words += ones[Math.floor(thousands / 100)] + ' Hundred ';
    }
    const remainThousands = thousands % 100;
    if (remainThousands >= 20) {
      words += tens[Math.floor(remainThousands / 10)] + ' ';
      words += ones[remainThousands % 10] + ' ';
    } else if (remainThousands >= 10) {
      words += teens[remainThousands - 10] + ' ';
    } else if (remainThousands > 0) {
      words += ones[remainThousands] + ' ';
    }
    words += 'Thousand ';
    intPart %= 1000;
  }

  if (intPart >= 100) {
    words += ones[Math.floor(intPart / 100)] + ' Hundred ';
    intPart %= 100;
  }

  if (intPart >= 20) {
    words += tens[Math.floor(intPart / 10)] + ' ';
    words += ones[intPart % 10] + ' ';
  } else if (intPart >= 10) {
    words += teens[intPart - 10] + ' ';
  } else if (intPart > 0) {
    words += ones[intPart] + ' ';
  }

  words += 'Pesos';

  if (decPart > 0) {
    words += ' and ' + decPart + '/100';
  }

  return words.trim();
}

// ── GET /dashboard/stats ── Get distribution dashboard statistics
router.get('/dashboard/stats', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    console.log('[DASHBOARD STATS] Request from user:', req.user.role, req.user.id);
    
    const where = {};

    // Staff can only see stats for their barangay
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && req.user.barangay_id) {
      where.barangay_id = req.user.barangay_id;
      console.log('[DASHBOARD STATS] Filtering by barangay:', req.user.barangay_id);
    } else {
      console.log('[DASHBOARD STATS] Admin - showing all barangays');
    }

    // Total events by status
    const totalEvents = await DistributionEvent.count({ where });
    const draftEvents = await DistributionEvent.count({ where: { ...where, status: 'draft' } });
    const scheduledEvents = await DistributionEvent.count({ where: { ...where, status: 'scheduled' } });
    const ongoingEvents = await DistributionEvent.count({ where: { ...where, status: 'ongoing' } });
    const completedEvents = await DistributionEvent.count({ where: { ...where, status: 'completed' } });

    console.log('[DASHBOARD STATS] Event counts:', { totalEvents, draftEvents, scheduledEvents, ongoingEvents, completedEvents });

    // Get event IDs for this user's scope
    const events = await DistributionEvent.findAll({ where, attributes: ['id'] });
    const eventIds = events.map(e => e.id);

    console.log('[DASHBOARD STATS] Found', eventIds.length, 'events');

    let transactionStats = {
      total_transactions: 0,
      pending_transactions: 0,
      released_transactions: 0,
      total_amount_allocated: 0,
      total_amount_released: 0,
      total_amount_pending: 0,
    };

    if (eventIds.length > 0) {
      transactionStats.total_transactions = await DistributionTransaction.count({
        where: { distribution_event_id: eventIds },
      });

      transactionStats.pending_transactions = await DistributionTransaction.count({
        where: { distribution_event_id: eventIds, status: 'pending' },
      });

      transactionStats.released_transactions = await DistributionTransaction.count({
        where: { distribution_event_id: eventIds, status: 'released' },
      });

      transactionStats.total_amount_allocated = await DistributionTransaction.sum('amount', {
        where: { distribution_event_id: eventIds },
      }) || 0;

      transactionStats.total_amount_released = await DistributionTransaction.sum('amount', {
        where: { distribution_event_id: eventIds, status: 'released' },
      }) || 0;

      transactionStats.total_amount_pending = transactionStats.total_amount_allocated - transactionStats.total_amount_released;
      
      console.log('[DASHBOARD STATS] Transaction stats:', transactionStats);
    }

    // Release percentage
    const releasePercentage = transactionStats.total_transactions > 0
      ? ((transactionStats.released_transactions / transactionStats.total_transactions) * 100).toFixed(2)
      : 0;

    console.log('[DASHBOARD STATS] Success - sending response');

    res.json({
      success: true,
      data: {
        events: {
          total: totalEvents,
          draft: draftEvents,
          scheduled: scheduledEvents,
          ongoing: ongoingEvents,
          completed: completedEvents,
        },
        transactions: {
          ...transactionStats,
          total_amount_allocated: parseFloat(transactionStats.total_amount_allocated).toFixed(2),
          total_amount_released: parseFloat(transactionStats.total_amount_released).toFixed(2),
          total_amount_pending: parseFloat(transactionStats.total_amount_pending).toFixed(2),
          release_percentage: parseFloat(releasePercentage),
        },
        scope: req.user.role === 'admin' ? 'all_barangays' : 'assigned_barangay',
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[DASHBOARD STATS] Error:', error);
    console.error('[DASHBOARD STATS] Error stack:', error.stack);
    next(error);
  }
});

// ── POST /verify-beneficiary ── Verify by RFID/QR/ID/Manual search
router.post('/verify-beneficiary', authorize('staff', 'barangay'), async (req, res, next) => {
  try {
    const { event_id, search_type, search_value } = req.body;

    if (!event_id || !search_type || !search_value) {
      return res.status(400).json({ 
        success: false, 
        message: 'event_id, search_type, and search_value are required',
        required_fields: ['event_id', 'search_type', 'search_value'],
        valid_search_types: ['rfid', 'qr', 'id', 'manual'],
      });
    }

    // Verify event exists and staff has access
    const event = await DistributionEvent.findByPk(event_id, {
      include: [
        { model: BenefitProgram, as: 'Program' },
        { model: Barangay }
      ],
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }

    // STRICT: Staff can only verify beneficiaries in their assigned barangay
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && req.user.role !== 'admin') {
      if (req.user.barangay_id !== event.barangay_id) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You can only verify beneficiaries in your assigned barangay',
          error_code: 'WRONG_BARANGAY_STAFF',
        });
      }
    }

    // Find beneficiary by search method
    let beneficiaryWhere = { status: 'Approved', barangay_id: event.barangay_id };
    
    switch (search_type.toLowerCase()) {
      case 'rfid':
        beneficiaryWhere.RFID_number = search_value.trim();
        break;
      case 'qr':
      case 'id':
        beneficiaryWhere.beneficiary_id_code = search_value.trim();
        break;
      case 'manual':
        beneficiaryWhere[Op.or] = [
          { first_name: { [Op.like]: `%${search_value}%` } },
          { last_name: { [Op.like]: `%${search_value}%` } },
          { beneficiary_id_code: { [Op.like]: `%${search_value}%` } },
          ...(search_value.match(/^\d+$/) ? [{ RFID_number: search_value }] : []),
        ];
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid search_type. Use: rfid, qr, id, or manual' 
        });
    }

    const beneficiaries = await Beneficiary.findAll({
      where: beneficiaryWhere,
      include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
      limit: 10,
    });

    if (beneficiaries.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No beneficiary found matching the search criteria',
        search_type,
        search_value,
      });
    }

    // For each found beneficiary, check if they have a transaction in this event
    const results = [];
    for (const b of beneficiaries) {
      const txn = await DistributionTransaction.findOne({
        where: { distribution_event_id: event_id, beneficiary_id: b.id },
      });

      // Enrollment check
      const enrollment = await Enrollment.findOne({
        where: {
          beneficiary_id: b.id,
          program_id: event.program_id,
          status: 'active',
        },
      });

      const checks = {
        registered: true,
        eligible: b.status === 'Approved',
        enrolled_in_program: !!enrollment,
        has_transaction: !!txn,
        not_yet_claimed: txn ? txn.status === 'pending' : false,
        correct_barangay: b.barangay_id === event.barangay_id,
        included_in_batch: !!txn,
      };

      const allValid = Object.values(checks).every(Boolean);

      results.push({
        beneficiary: {
          id: b.id,
          first_name: b.first_name,
          last_name: b.last_name,
          middle_name: b.middle_name,
          full_name: `${b.first_name} ${b.middle_name || ''} ${b.last_name}`.trim(),
          category: b.category,
          RFID_number: b.RFID_number,
          beneficiary_id_code: b.beneficiary_id_code,
          profile_photo: b.profile_photo,
          contact_number: b.contact_number,
          barangay: b.Barangay?.barangay_name,
          status: b.status,
        },
        transaction: txn ? {
          id: txn.id,
          transaction_number: txn.transaction_number,
          amount: parseFloat(txn.amount),
          formatted_amount: `₱${parseFloat(txn.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
          status: txn.status,
          released_at: txn.released_at,
          verification_method: txn.verification_method,
        } : null,
        event: {
          id: event.id,
          title: event.title,
          program: event.Program?.name,
          distribution_date: event.distribution_date,
          venue: event.venue,
          status: event.status,
        },
        verification: {
          verified: allValid,
          can_release: allValid && txn?.status === 'pending',
          checks,
        },
      });
    }

    // Log verification attempt
    await AuditLog.create({
      user_id: req.user.id,
      action: `Searched beneficiary using ${search_type}: "${search_value}" - ${results.length} result(s)`,
      module: 'distributions',
      details: JSON.stringify({ event_id, search_type, results_count: results.length }),
    });

    res.json({ 
      success: true, 
      data: results,
      count: results.length,
      search_criteria: { event_id, search_type, search_value },
    });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /events/:id ── Delete a distribution event (Admin only)
router.delete('/events/:id', authorize('admin'), async (req, res, next) => {
  try {
    const event = await DistributionEvent.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Distribution event not found' });
    }

    // Only draft events can be deleted
    if (event.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft events can be deleted' });
    }

    await DistributionTransaction.destroy({ where: { distribution_event_id: event.id } });
    await event.destroy();

    await AuditLog.create({
      user_id: req.user.id,
      action: `Deleted distribution event: ${event.title}`,
      module: 'distributions',
    });

    res.json({ success: true, message: 'Distribution event deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
