const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { BenefitProgram, Enrollment, Beneficiary, Barangay, DistributionEvent, DistributionTransaction, AuditLog, Notification } = require('../db');
const { isMswdoRole, MSWDO_ELIGIBILITY_FILTER, isMswdoCategory, isMswdoEligibility } = require('../utils/roles');

const router = express.Router();
router.use(authenticate);

const mapProgramPayload = (body) => {
  const { category, ...rest } = body;
  return {
    ...rest,
    eligibility_category: body.eligibility_category || category || null,
  };
};

// ── GET / ── List programs (barangay-scoped)
// Admin: all programs (can filter via ?barangay_id=&status=).
// Staff/Barangay: only programs assigned to their barangay.
// Beneficiary: only programs assigned to their barangay that they are enrolled in.
router.get('/', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    const where = {};

    if (['admin','mswdo_admin'].includes(req.user.role)) {
      // Admin can optionally filter by barangay and/or status
      if (req.query.barangay_id) {
        where.barangay_id = req.query.barangay_id;
      }
      if (req.query.status) {
        where.status = req.query.status;
      }
      if (req.user.role === 'mswdo_admin') {
        // MSWDO Admin strictly sees ONLY MSWDO municipal programs (including MSWDO 4Ps programs)
        where.agency = 'MSWDO';
      } else if (req.user.role === 'admin') {
        // DSWD Admin strictly manages DSWD programs only
        where.agency = 'DSWD';
      }
    } else if (req.user.role === 'beneficiary') {
      // Beneficiary sees only programs in their barangay that they are enrolled in
      const enrollments = await Enrollment.findAll({
        include: [{ model: Beneficiary, where: { user_id: req.user.id } }],
        attributes: ['program_id'],
      });
      const programIds = enrollments.map(e => e.program_id);
      if (programIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      where.id = programIds;
      where.barangay_id = req.user.barangay_id;
      where.status = 'active';
    } else {
      // Staff / Barangay — scoped to their assigned barangay, or all programs if unassigned/general
      const staffBrgyId = req.user.barangay_id;
      if (staffBrgyId) {
        where[Op.or] = [
          { barangay_id: staffBrgyId },
          { barangay_id: String(staffBrgyId) },
          { barangay_id: Number(staffBrgyId) },
          { barangay_id: null },
          { barangay_id: 0 }
        ];
      }
      if (req.query.status) {
        where.status = req.query.status;
      }
    }

    const programs = await BenefitProgram.findAll({
      where,
      include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, data: programs });
  } catch (error) {
    next(error);
  }
});

// ── GET /eligible-preview ── Preview eligible beneficiaries for category and barangay(s)
router.get('/eligible-preview', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const { category, barangay_ids, program_id } = req.query;

    let targetBarangayIds = [];

    // Role-based barangay scoping for staff / barangay
    if (['staff', 'barangay'].includes(req.user.role)) {
      if (req.user.barangay_id) {
        targetBarangayIds = [Number(req.user.barangay_id)];
      }
    } else if (barangay_ids) {
      if (Array.isArray(barangay_ids)) {
        targetBarangayIds = barangay_ids.map(Number).filter(Boolean);
      } else {
        targetBarangayIds = String(barangay_ids)
          .split(',')
          .map((id) => Number(id.trim()))
          .filter(Boolean);
      }
    }

    const whereClause = {
      status: 'Approved',
    };

    if (targetBarangayIds.length > 0) {
      whereClause.barangay_id = { [Op.in]: targetBarangayIds };
    }

    if (category) {
      const cat = category;
      const isPwd = cat.toLowerCase().includes('pwd') || cat.toLowerCase().includes('disabilit');
      const isSenior = cat.toLowerCase().includes('senior');
      const is4ps = cat.toLowerCase().includes('4ps') || cat.toLowerCase().includes('4p');

      if (isPwd) {
        whereClause.category = {
          [Op.or]: [
            { [Op.like]: '%PWD%' },
            { [Op.like]: '%Disabilit%' },
            { [Op.like]: '%Person with Disability%' },
            { [Op.like]: '%Persons with Disabilities%' },
          ],
        };
      } else if (isSenior) {
        whereClause.category = { [Op.like]: '%Senior%' };
      } else if (is4ps) {
        whereClause.category = { [Op.like]: '%4Ps%' };
      } else {
        whereClause.category = { [Op.like]: `%${cat}%` };
      }
    }

    // If MSWDO Admin without specific category, enforce MSWDO scope (includes 4Ps, Senior, PWD)
    if (req.user.role === 'mswdo_admin' && !category) {
      whereClause[Op.or] = [
        { category: { [Op.like]: '%Senior%' } },
        { category: { [Op.like]: '%PWD%' } },
        { category: { [Op.like]: '%Disabilit%' } },
        { category: { [Op.like]: '%4Ps%' } },
        { category: { [Op.like]: '%Pantawid%' } },
      ];
    }

    const beneficiaries = await Beneficiary.findAll({
      where: whereClause,
      include: [
        { model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] },
      ],
      order: [
        ['barangay_id', 'ASC'],
        ['last_name', 'ASC'],
        ['first_name', 'ASC'],
      ],
    });

    // If program_id is supplied, check who is already enrolled
    let enrolledBeneficiaryIds = new Set();
    if (program_id) {
      const existingEnrollments = await Enrollment.findAll({
        where: { program_id, status: 'active' },
        attributes: ['beneficiary_id'],
      });
      enrolledBeneficiaryIds = new Set(existingEnrollments.map((e) => e.beneficiary_id));
    }

    // Group count by barangay
    const byBarangay = {};
    const formattedList = beneficiaries.map((b) => {
      const bgyName = b.Barangay?.barangay_name || `Barangay ${b.barangay_id}`;
      byBarangay[bgyName] = (byBarangay[bgyName] || 0) + 1;

      return {
        id: b.id,
        first_name: b.first_name,
        last_name: b.last_name,
        middle_name: b.middle_name,
        suffix: b.suffix,
        beneficiary_id_code: b.beneficiary_id_code,
        category: b.category,
        barangay_id: b.barangay_id,
        barangay_name: bgyName,
        contact_number: b.contact_number,
        phone_number: b.phone_number,
        status: b.status,
        is_enrolled: program_id ? enrolledBeneficiaryIds.has(b.id) : false,
      };
    });

    res.json({
      success: true,
      total_eligible: formattedList.length,
      by_barangay: byBarangay,
      data: formattedList,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id ── Get single program (barangay-enforced)
router.get('/:id', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    const program = await BenefitProgram.findByPk(req.params.id, {
      include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
    });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    // Enforce barangay access for non-admin users
    if (!['admin','mswdo_admin'].includes(req.user.role)) {
      if (program.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ success: false, message: 'Access Denied (403 Forbidden): This program is assigned to another barangay.' });
      }
    }
    // MSWDO strictly views MSWDO agency programs; DSWD Admin strictly views DSWD programs
    if (isMswdoRole(req.user.role)) {
      if (program.agency !== 'MSWDO') {
        return res.status(403).json({ success: false, message: 'Access Denied (403 Forbidden): MSWDO Admin cannot view or manage DSWD programs.' });
      }
    }
    if (req.user.role === 'admin' && program.agency === 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied (403 Forbidden): DSWD Admin cannot view or manage MSWDO programs.' });
    }

    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id/beneficiaries ── View enrolled beneficiaries for a program
router.get('/:id/beneficiaries', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const program = await BenefitProgram.findByPk(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    
    // Enforce barangay access for non-admin users ONLY
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      if (program.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ success: false, message: 'Access Denied: This program is assigned to another barangay.' });
      }
    }

    // MSWDO Admin cannot access beneficiaries of DSWD programs
    if (req.user.role === 'mswdo_admin' && program.agency !== 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: MSWDO Admin cannot view beneficiaries of DSWD programs.' });
    }
    if (req.user.role === 'admin' && program.agency === 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: DSWD Admin cannot view beneficiaries of MSWDO programs.' });
    }

    const enrollments = await Enrollment.findAll({
      where: { program_id: req.params.id, status: 'active' },
      include: [{
        model: Beneficiary,
        include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
      }],
    });
    const beneficiaries = enrollments.map(e => ({
      enrollment_id: e.id,
      enrollment_date: e.enrollment_date,
      enrollment_status: e.status,
      ...e.Beneficiary?.dataValues,
    }));
    res.json({ success: true, data: beneficiaries });
  } catch (error) {
    next(error);
  }
});

// ── POST /:id/auto-enroll ── Auto-enroll eligible beneficiaries for existing program
router.post('/:id/auto-enroll', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const program = await BenefitProgram.findByPk(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    if (req.user.role === 'mswdo_admin' && program.agency !== 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: MSWDO Admin cannot auto-enroll into DSWD programs.' });
    }

    // Enforce barangay access for staff ONLY (admins can access all)
    if (req.user.role === 'staff') {
      if (program.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access Denied: This program is assigned to another barangay.' 
        });
      }
    }

    // Get already enrolled beneficiary IDs to avoid duplicates
    const existingEnrollments = await Enrollment.findAll({
      where: { program_id: program.id },
      attributes: ['beneficiary_id']
    });
    const alreadyEnrolledIds = existingEnrollments.map(e => e.beneficiary_id);

    // Build where clause for eligible beneficiaries
    const whereClause = {
      status: 'Approved',
      barangay_id: program.barangay_id,
      id: { [Op.notIn]: alreadyEnrolledIds.length > 0 ? alreadyEnrolledIds : [0] }
    };

    // If program has eligibility_category, filter by category using flexible matching
    // Handles synonyms like "Person with Disability (PWD)" vs "Persons with Disabilities (PWD)"
    if (program.eligibility_category) {
      const cat = program.eligibility_category;
      const isPwd = cat.toLowerCase().includes('pwd') || cat.toLowerCase().includes('disabilit');
      const isSenior = cat.toLowerCase().includes('senior');
      const is4ps = cat.toLowerCase().includes('4ps') || cat.toLowerCase().includes('4p');

      if (isPwd) {
        // Match any PWD-related category
        whereClause.category = {
          [Op.or]: [
            { [Op.like]: '%PWD%' },
            { [Op.like]: '%Disabilit%' },
            { [Op.like]: '%Person with Disability%' },
            { [Op.like]: '%Persons with Disabilities%' }
          ]
        };
      } else if (isSenior) {
        whereClause.category = { [Op.like]: '%Senior%' };
      } else if (is4ps) {
        whereClause.category = { [Op.like]: '%4Ps%' };
      } else {
        whereClause.category = { [Op.like]: `%${cat}%` };
      }
    }

    // Find all eligible beneficiaries not yet enrolled
    const eligibleBeneficiaries = await Beneficiary.findAll({
      where: whereClause,
      attributes: ['id']
    });

    if (eligibleBeneficiaries.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No new eligible beneficiaries to enroll. All qualified beneficiaries are already enrolled.',
        data: {
          newly_enrolled: 0,
          already_enrolled: alreadyEnrolledIds.length
        }
      });
    }

    // Create enrollments for all eligible beneficiaries
    const enrollmentData = eligibleBeneficiaries.map(b => ({
      program_id: program.id,
      beneficiary_id: b.id,
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'active'
    }));

    const enrollments = await Enrollment.bulkCreate(enrollmentData);

    // Sync beneficiary categories to match program eligibility_category if applicable
    if (program.eligibility_category) {
      let stdCat = program.eligibility_category;
      const lower = stdCat.toLowerCase();
      if (lower.includes('4ps')) stdCat = '4Ps Household Beneficiaries';
      else if (lower.includes('senior')) stdCat = 'Senior Citizens (Social Pension)';
      else if (lower.includes('pwd') || lower.includes('disabil')) stdCat = 'Persons with Disabilities (PWD)';

      await Beneficiary.update(
        { category: stdCat },
        { where: { id: eligibleBeneficiaries.map(b => b.id) } }
      );
    }

    // Create notifications for enrolled beneficiaries who have a user account
    const beneficiariesWithUsers = await Beneficiary.findAll({
      where: { id: eligibleBeneficiaries.map(b => b.id) },
      attributes: ['id', 'user_id']
    });

    const notificationPromises = beneficiariesWithUsers
      .filter(b => b.user_id)
      .map(b => Notification.create({
        user_id: b.user_id,
        title: 'Program Enrollment Confirmation',
        message: `You have been officially enrolled in the program "${program.name}". Category: ${program.eligibility_category || 'General'}. Check your benefits dashboard for upcoming distributions and details.`,
        type: 'program',
        reference_id: program.id,
        reference_type: 'BenefitProgram',
        is_read: false,
      }));

    await Promise.all(notificationPromises);

    // Log auto-enrollment action
    await AuditLog.create({
      user_id: req.user.id,
      action: `Auto-enrolled ${enrollments.length} eligible beneficiary(ies) into program: ${program.name}`,
      module: 'programs',
    });

    res.json({ 
      success: true, 
      message: `Successfully auto-enrolled ${enrollments.length} eligible beneficiary(ies)`,
      data: {
        newly_enrolled: enrollments.length,
        already_enrolled: alreadyEnrolledIds.length,
        total_enrolled: alreadyEnrolledIds.length + enrollments.length
      }
    });
  } catch (error) {
    console.error('Auto-enrollment error:', error);
    next(error);
  }
});

// ── POST /:id/enroll ── Enroll multiple beneficiaries into a program
router.post('/:id/enroll', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    console.log('Enrollment request body:', req.body);
    console.log('Enrollment request params:', req.params);
    
    const { beneficiary_ids } = req.body;

    console.log('Extracted beneficiary_ids:', beneficiary_ids);
    console.log('Is array?', Array.isArray(beneficiary_ids));
    console.log('Length:', beneficiary_ids?.length);

    if (!beneficiary_ids || !Array.isArray(beneficiary_ids) || beneficiary_ids.length === 0) {
      console.error('Invalid beneficiary_ids:', beneficiary_ids);
      return res.status(400).json({ 
        success: false, 
        message: 'beneficiary_ids is required and must be a non-empty array' 
      });
    }

    // Get program details
    const program = await BenefitProgram.findByPk(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    if (req.user.role === 'mswdo_admin' && program.agency !== 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: MSWDO Admin cannot enroll into DSWD programs.' });
    }

    // Enforce barangay access for staff ONLY (admins can access all)
    if (req.user.role === 'staff') {
      if (program.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access Denied: This program is assigned to another barangay.' 
        });
      }
    }

    // Check for existing enrollments to prevent duplicates
    const existingEnrollments = await Enrollment.findAll({
      where: {
        program_id: req.params.id,
        beneficiary_id: beneficiary_ids
      }
    });

    const alreadyEnrolled = existingEnrollments.map(e => e.beneficiary_id);
    const newBeneficiaryIds = beneficiary_ids.filter(id => !alreadyEnrolled.includes(id));

    if (newBeneficiaryIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'All selected beneficiaries are already enrolled in this program' 
      });
    }

    // Validate beneficiaries exist and are eligible
    const beneficiaries = await Beneficiary.findAll({
      where: { id: newBeneficiaryIds }
    });

    if (beneficiaries.length !== newBeneficiaryIds.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'One or more beneficiary IDs are invalid' 
      });
    }

    // Validate eligibility criteria
    console.log('Program eligibility_category:', program.eligibility_category);
    console.log('Program barangay_id:', program.barangay_id);
    
    const ineligible = beneficiaries.map(b => {
      const reasons = [];
      console.log(`Checking beneficiary ${b.id} (${b.first_name} ${b.last_name}):`, {
        status: b.status,
        barangay_id: b.barangay_id,
        category: b.category
      });
      
      if (b.status !== 'Approved') reasons.push('not approved');
      if (b.barangay_id !== program.barangay_id) reasons.push('wrong barangay');
      
      // Check category eligibility
      if (program.eligibility_category) {
        // Normalize categories for comparison (case-insensitive, handle singular/plural)
        const normalizeCategory = (cat) => cat?.toLowerCase().replace(/ies$/i, 'y').replace(/s$/i, '');
        const programCat = normalizeCategory(program.eligibility_category);
        const beneficiaryCat = normalizeCategory(b.category);
        
        // Check if categories match (or beneficiary category contains program category)
        const hasMatchingCategory = b.category && (
          beneficiaryCat === programCat || 
          beneficiaryCat?.includes(programCat) ||
          b.category.toLowerCase().includes(program.eligibility_category.toLowerCase())
        );
        
        if (!hasMatchingCategory) {
          reasons.push(`category mismatch (needs: ${program.eligibility_category}, has: ${b.category || 'none'})`);
        }
      }
      
      return reasons.length > 0 ? { id: b.id, name: `${b.first_name} ${b.last_name}`, reasons } : null;
    }).filter(b => b !== null);

    console.log('Ineligible beneficiaries:', ineligible);

    if (ineligible.length > 0) {
      console.log('Ineligible beneficiaries details:', ineligible);
      const details = ineligible.map(b => `${b.name}: ${b.reasons.join(', ')}`).join('; ');
      const fullMessage = `${ineligible.length} beneficiary(ies) do not meet eligibility criteria: ${details}`;
      console.log('Sending error message:', fullMessage);
      return res.status(400).json({ 
        success: false, 
        message: fullMessage
      });
    }

    // Create enrollments
    const enrollmentData = newBeneficiaryIds.map(beneficiary_id => ({
      program_id: parseInt(req.params.id),
      beneficiary_id: beneficiary_id,
      enrollment_date: new Date().toISOString().split('T')[0],
      status: 'active'
    }));

    const createdEnrollments = await Enrollment.bulkCreate(enrollmentData);

    // Sync beneficiary categories to match program eligibility_category if applicable
    if (program.eligibility_category && newBeneficiaryIds.length > 0) {
      let stdCat = program.eligibility_category;
      const lower = stdCat.toLowerCase();
      if (lower.includes('4ps')) stdCat = '4Ps Household Beneficiaries';
      else if (lower.includes('senior')) stdCat = 'Senior Citizens (Social Pension)';
      else if (lower.includes('pwd') || lower.includes('disabil')) stdCat = 'Persons with Disabilities (PWD)';

      await Beneficiary.update(
        { category: stdCat },
        { where: { id: newBeneficiaryIds } }
      );
    }

    // Create notifications for enrolled beneficiaries who have a user account
    const notificationPromises = beneficiaries
      .filter(b => b.user_id)
      .map(b => Notification.create({
        user_id: b.user_id,
        title: 'Program Enrollment Confirmation',
        message: `You have been officially enrolled in the program "${program.name}". Category: ${program.eligibility_category || 'General'}. Check your benefits dashboard for upcoming distributions and details.`,
        type: 'program',
        reference_id: program.id,
        reference_type: 'BenefitProgram',
        is_read: false,
      }));

    await Promise.all(notificationPromises);

    // Log the action
    await AuditLog.create({
      user_id: req.user.id,
      action: `Enrolled ${createdEnrollments.length} beneficiary(ies) into program: ${program.name}`,
      module: 'programs',
    });

    res.status(201).json({ 
      success: true, 
      message: `Successfully enrolled ${createdEnrollments.length} beneficiary(ies)`,
      data: {
        enrolled_count: createdEnrollments.length,
        already_enrolled_count: alreadyEnrolled.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// ── POST / ── Create a new program (Admin only) — MSWDO limited to Senior/PWD
// Admin must provide barangay_id to assign the program to a specific barangay.
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    if (!req.body.barangay_id) {
      return res.status(400).json({ success: false, message: 'barangay_id is required. Each program must be assigned to a specific barangay.' });
    }
    const agency = req.user.role === 'mswdo_admin' ? 'MSWDO' : 'DSWD';
    const programData = {
      ...mapProgramPayload(req.body),
      agency,
      created_by: req.user.id,
    };
    const program = await BenefitProgram.create(programData);

    // Reload with Barangay association so the response includes barangay info
    const created = await BenefitProgram.findByPk(program.id, {
      include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
    });

    // AUTO-ENROLLMENT: Automatically enroll eligible beneficiaries
    let autoEnrolledCount = 0;
    try {
      // Build where clause for eligible beneficiaries
      const whereClause = {
        status: 'Approved',
        barangay_id: program.barangay_id
      };

      // Flexible category matching — handles PWD synonyms
      if (program.eligibility_category) {
        const cat = program.eligibility_category;
        const isPwd = cat.toLowerCase().includes('pwd') || cat.toLowerCase().includes('disabilit');
        const isSenior = cat.toLowerCase().includes('senior');
        const is4ps = cat.toLowerCase().includes('4ps') || cat.toLowerCase().includes('4p');

        if (isPwd) {
          whereClause.category = {
            [Op.or]: [
              { [Op.like]: '%PWD%' },
              { [Op.like]: '%Disabilit%' },
              { [Op.like]: '%Person with Disability%' },
              { [Op.like]: '%Persons with Disabilities%' }
            ]
          };
        } else if (isSenior) {
          whereClause.category = { [Op.like]: '%Senior%' };
        } else if (is4ps) {
          whereClause.category = { [Op.like]: '%4Ps%' };
        } else {
          whereClause.category = { [Op.like]: `%${cat}%` };
        }
      }

      // Find all eligible beneficiaries
      const eligibleBeneficiaries = await Beneficiary.findAll({
        where: whereClause,
        attributes: ['id']
      });

      if (eligibleBeneficiaries.length > 0) {
        // Create enrollments for all eligible beneficiaries
        const enrollmentData = eligibleBeneficiaries.map(b => ({
          program_id: program.id,
          beneficiary_id: b.id,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'active'
        }));

        const enrollments = await Enrollment.bulkCreate(enrollmentData);
        autoEnrolledCount = enrollments.length;

        // Log auto-enrollment action
        await AuditLog.create({
          user_id: req.user.id,
          action: `Auto-enrolled ${autoEnrolledCount} eligible beneficiary(ies) into program: ${program.name}`,
          module: 'programs',
        });
      }
    } catch (enrollError) {
      console.error('Auto-enrollment error:', enrollError);
      // Don't fail program creation if auto-enrollment fails
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: `Created program: ${program.name} (Barangay ID: ${program.barangay_id})`,
      module: 'programs',
    });

    res.status(201).json({ 
      success: true, 
      data: created,
      auto_enrolled_count: autoEnrolledCount 
    });
  } catch (error) {
    next(error);
  }
});

// ── PUT /:id ── Edit/Archive a program (Admin, Staff, Barangay)
router.put('/:id', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const program = await BenefitProgram.findByPk(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    if (req.user.role === 'mswdo_admin' && program.agency !== 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: MSWDO Admin cannot modify DSWD programs.' });
    }
    if (req.user.role === 'admin' && program.agency === 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: DSWD Admin cannot modify MSWDO programs.' });
    }
    await program.update(mapProgramPayload(req.body));

    const updated = await BenefitProgram.findByPk(program.id, {
      include: [{ model: Barangay, attributes: ['id', 'barangay_name', 'barangay_code'] }],
    });

    await AuditLog.create({
      user_id: req.user.id,
      action: `Updated program: ${program.name}`,
      module: 'programs',
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /:id/status ── Activate/Deactivate program (Admin only)
router.patch('/:id/status', authorize('admin'), async (req, res, next) => {
  try {
    const program = await BenefitProgram.findByPk(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    if (req.user.role === 'mswdo_admin' && program.agency !== 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: MSWDO Admin cannot change status of DSWD programs.' });
    }
    if (req.user.role === 'admin' && program.agency === 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: DSWD Admin cannot change status of MSWDO programs.' });
    }
    const newStatus = program.status === 'active' ? 'inactive' : 'active';
    await program.update({ status: newStatus });
    await AuditLog.create({
      user_id: req.user.id,
      action: `${newStatus === 'active' ? 'Activated' : 'Deactivated'} program: ${program.name}`,
      module: 'programs',
    });
    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /:id ── Delete a program (Admin only)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const program = await BenefitProgram.findByPk(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    if (req.user.role === 'mswdo_admin' && program.agency !== 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: MSWDO Admin cannot delete DSWD programs.' });
    }
    if (req.user.role === 'admin' && program.agency === 'MSWDO') {
      return res.status(403).json({ success: false, message: 'Access Denied: DSWD Admin cannot delete MSWDO programs.' });
    }

    // Cascade: delete distribution transactions → events → enrollments → program
    const events = await DistributionEvent.findAll({ where: { program_id: req.params.id } });
    for (const event of events) {
      await DistributionTransaction.destroy({ where: { distribution_event_id: event.id } });
    }
    await DistributionEvent.destroy({ where: { program_id: req.params.id } });
    await Enrollment.destroy({ where: { program_id: req.params.id } });
    await BenefitProgram.destroy({ where: { id: req.params.id } });

    await AuditLog.create({
      user_id: req.user.id,
      action: `Deleted program: ${program.name}`,
      module: 'programs',
    });

    res.json({ success: true, message: 'Program deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
