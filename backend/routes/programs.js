const express = require('express');
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
    // Enforce barangay access for non-admin users
    if (req.user.role !== 'admin') {
      const program = await BenefitProgram.findByPk(req.params.id);
      if (!program || program.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ success: false, message: 'Access Denied (403 Forbidden): This program is assigned to another barangay.' });
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

// ── POST /:id/enroll ── Enroll multiple beneficiaries into a program
router.post('/:id/enroll', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const { beneficiary_ids } = req.body;

    if (!beneficiary_ids || !Array.isArray(beneficiary_ids) || beneficiary_ids.length === 0) {
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

    // Enforce barangay access for non-admin users
    if (req.user.role !== 'admin') {
      if (program.barangay_id !== req.user.barangay_id) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access Denied (403 Forbidden): This program is assigned to another barangay.' 
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
    const ineligible = beneficiaries.filter(b => {
      if (b.status !== 'Approved') return true;
      if (b.barangay_id !== program.barangay_id) return true;
      if (program.eligibility_category && (!b.category || !b.category.includes(program.eligibility_category))) {
        return true;
      }
      return false;
    });

    if (ineligible.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `${ineligible.length} beneficiary(ies) do not meet eligibility criteria` 
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

    await AuditLog.create({
      user_id: req.user.id,
      action: `Created program: ${program.name} (Barangay ID: ${program.barangay_id})`,
      module: 'programs',
    });
    res.status(201).json({ success: true, data: created });
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
