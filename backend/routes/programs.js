const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { BenefitProgram, Enrollment, Beneficiary, Barangay, DistributionEvent, DistributionTransaction, AuditLog } = require('../db');

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

    if (req.user.role === 'admin') {
      // Admin can optionally filter by barangay and/or status
      if (req.query.barangay_id) {
        where.barangay_id = req.query.barangay_id;
      }
      if (req.query.status) {
        where.status = req.query.status;
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
      // Staff / Barangay — only active programs for their barangay
      where.barangay_id = req.user.barangay_id;
      where.status = 'active';
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
    if (req.user.role !== 'admin') {
      if (program.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ success: false, message: 'Access Denied (403 Forbidden): This program is assigned to another barangay.' });
      }
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
      id: { [Op.notIn]: alreadyEnrolledIds.length > 0 ? alreadyEnrolledIds : [0] } // Exclude already enrolled
    };

    // If program has eligibility_category, filter by matching category
    if (program.eligibility_category) {
      whereClause.category = {
        [Op.like]: `%${program.eligibility_category}%`
      };
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

// ── POST / ── Create a new program (Admin only)
// Admin must provide barangay_id to assign the program to a specific barangay.
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    if (!req.body.barangay_id) {
      return res.status(400).json({ success: false, message: 'barangay_id is required. Each program must be assigned to a specific barangay.' });
    }

    const program = await BenefitProgram.create(mapProgramPayload(req.body));

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

      // If program has eligibility_category, filter by matching category
      if (program.eligibility_category) {
        whereClause.category = {
          [Op.like]: `%${program.eligibility_category}%`
        };
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

// ── PUT /:id ── Edit a program (Admin only)
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const program = await BenefitProgram.findByPk(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
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
