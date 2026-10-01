const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Intervention, Beneficiary, User, Barangay, Notification } = require('../db');

const router = express.Router();
router.use(authenticate);

// Configure multer for proof document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/interventions');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `intervention-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, PNG, and WEBP are allowed.'));
    }
  }
});

// ── GET /api/interventions/me ── Beneficiary gets their own interventions
router.get('/me', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    const interventions = await Intervention.findAll({
      where: { beneficiary_id: beneficiary.id },
      include: [
        { model: User, as: 'Verifier', attributes: ['id', 'first_name', 'last_name', 'role'] }
      ],
      order: [['date_received', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({ success: true, data: interventions });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/interventions/submit ── Beneficiary submits intervention report
router.post('/submit', authorize('beneficiary'), upload.single('proof_document'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    const { agency_name, assistance_type, amount, description, date_received } = req.body;

    if (!agency_name || !assistance_type || !date_received) {
      return res.status(400).json({
        success: false,
        message: 'Agency name, assistance type, and date received are required'
      });
    }

    const proofDocumentUrl = req.file ? `/uploads/interventions/${req.file.filename}` : null;

    const intervention = await Intervention.create({
      beneficiary_id: beneficiary.id,
      user_id: req.user.id,
      barangay_id: beneficiary.barangay_id,
      agency_name: agency_name.trim(),
      assistance_type: assistance_type.trim(),
      amount: amount ? parseFloat(amount) : 0,
      description: description ? description.trim() : null,
      date_received,
      proof_document_url: proofDocumentUrl,
      status: 'Pending'
    });

    // Create notification for staff/admin
    await Notification.create({
      user_id: req.user.id,
      type: 'intervention_submitted',
      title: 'New Intervention Report',
      message: `${beneficiary.first_name} ${beneficiary.last_name} submitted an intervention report for ${assistance_type} from ${agency_name}.`,
      is_read: false
    });

    res.status(201).json({
      success: true,
      message: 'Intervention report submitted successfully. Waiting for staff verification.',
      data: intervention
    });
  } catch (error) {
    next(error);
  }
});

// ── PUT /api/interventions/me/:id ── Beneficiary updates their pending intervention
router.put('/me/:id', authorize('beneficiary'), upload.single('proof_document'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    const intervention = await Intervention.findOne({
      where: {
        id: req.params.id,
        beneficiary_id: beneficiary.id
      }
    });

    if (!intervention) {
      return res.status(404).json({ success: false, message: 'Intervention not found' });
    }

    if (intervention.status === 'Verified') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit verified intervention'
      });
    }

    const { agency_name, assistance_type, amount, description, date_received } = req.body;

    const updates = {};
    if (agency_name) updates.agency_name = agency_name.trim();
    if (assistance_type) updates.assistance_type = assistance_type.trim();
    if (amount !== undefined) updates.amount = parseFloat(amount) || 0;
    if (description !== undefined) updates.description = description ? description.trim() : null;
    if (date_received) updates.date_received = date_received;

    if (req.file) {
      // Delete old file if exists
      if (intervention.proof_document_url) {
        const oldFilePath = path.join(__dirname, '..', intervention.proof_document_url);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      updates.proof_document_url = `/uploads/interventions/${req.file.filename}`;
    }

    // Reset status to Pending if it was rejected
    if (intervention.status === 'Rejected') {
      updates.status = 'Pending';
      updates.rejection_reason = null;
    }

    await intervention.update(updates);

    res.json({
      success: true,
      message: 'Intervention updated successfully',
      data: intervention
    });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/interventions/me/:id ── Beneficiary deletes their pending intervention
router.delete('/me/:id', authorize('beneficiary'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary profile not found' });
    }

    const intervention = await Intervention.findOne({
      where: {
        id: req.params.id,
        beneficiary_id: beneficiary.id
      }
    });

    if (!intervention) {
      return res.status(404).json({ success: false, message: 'Intervention not found' });
    }

    if (intervention.status === 'Verified') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete verified intervention. Please contact staff.'
      });
    }

    // Delete proof document file if exists
    if (intervention.proof_document_url) {
      const filePath = path.join(__dirname, '..', intervention.proof_document_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await intervention.destroy();

    res.json({
      success: true,
      message: 'Intervention deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/interventions/pending ── Staff/Admin gets pending interventions
router.get('/pending', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const where = { status: 'Pending' };

    // Staff can only see interventions from their barangay
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      where.barangay_id = req.user.barangay_id;
    }

    const interventions = await Intervention.findAll({
      where,
      include: [
        {
          model: Beneficiary,
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }]
        }
      ],
      order: [['created_at', 'ASC']]
    });

    res.json({ success: true, data: interventions });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/interventions/all ── Staff/Admin gets all interventions with filters
router.get('/all', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const { status, beneficiary_id, agency_name, date_from, date_to } = req.query;

    const where = {};

    // Staff can only see interventions from their barangay
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      where.barangay_id = req.user.barangay_id;
    }

    if (status) where.status = status;
    if (beneficiary_id) where.beneficiary_id = beneficiary_id;
    if (agency_name) where.agency_name = { [Op.like]: `%${agency_name}%` };

    if (date_from && date_to) {
      where.date_received = {
        [Op.between]: [date_from, date_to]
      };
    } else if (date_from) {
      where.date_received = { [Op.gte]: date_from };
    } else if (date_to) {
      where.date_received = { [Op.lte]: date_to };
    }

    const interventions = await Intervention.findAll({
      where,
      include: [
        {
          model: Beneficiary,
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }]
        },
        { model: User, as: 'Verifier', attributes: ['id', 'first_name', 'last_name', 'role'] }
      ],
      order: [['date_received', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({ success: true, data: interventions });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/interventions/beneficiary/:beneficiaryId ── Staff/Admin gets interventions for specific beneficiary
router.get('/beneficiary/:beneficiaryId', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findByPk(req.params.beneficiaryId);
    if (!beneficiary) {
      return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    }

    // Staff can only view beneficiaries from their barangay
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && beneficiary.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const interventions = await Intervention.findAll({
      where: { beneficiary_id: req.params.beneficiaryId },
      include: [
        { model: User, as: 'Verifier', attributes: ['id', 'first_name', 'last_name', 'role'] }
      ],
      order: [['date_received', 'DESC']]
    });

    // Calculate totals
    const summary = {
      total_interventions: interventions.length,
      total_verified: interventions.filter(i => i.status === 'Verified').length,
      total_pending: interventions.filter(i => i.status === 'Pending').length,
      total_rejected: interventions.filter(i => i.status === 'Rejected').length,
      total_amount: interventions
        .filter(i => i.status === 'Verified')
        .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0)
    };

    res.json({ success: true, data: interventions, summary });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/interventions/:id/verify ── Staff/Admin verifies intervention
router.post('/:id/verify', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const intervention = await Intervention.findByPk(req.params.id, {
      include: [
        {
          model: Beneficiary,
          include: [{ model: User }]
        }
      ]
    });

    if (!intervention) {
      return res.status(404).json({ success: false, message: 'Intervention not found' });
    }

    // Staff can only verify interventions from their barangay
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && intervention.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (intervention.status === 'Verified') {
      return res.status(400).json({ success: false, message: 'Intervention already verified' });
    }

    const { staff_notes } = req.body;

    await intervention.update({
      status: 'Verified',
      verified_by: req.user.id,
      verified_at: new Date(),
      staff_notes: staff_notes || null,
      rejection_reason: null
    });

    // Notify beneficiary
    if (intervention.Beneficiary && intervention.Beneficiary.User) {
      await Notification.create({
        user_id: intervention.Beneficiary.user_id,
        type: 'intervention_verified',
        title: 'Intervention Verified',
        message: `Your intervention report for ${intervention.assistance_type} from ${intervention.agency_name} has been verified by staff.`,
        is_read: false
      });
    }

    res.json({
      success: true,
      message: 'Intervention verified successfully',
      data: intervention
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/interventions/:id/reject ── Staff/Admin rejects intervention
router.post('/:id/reject', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const intervention = await Intervention.findByPk(req.params.id, {
      include: [
        {
          model: Beneficiary,
          include: [{ model: User }]
        }
      ]
    });

    if (!intervention) {
      return res.status(404).json({ success: false, message: 'Intervention not found' });
    }

    // Staff can only reject interventions from their barangay
    if ((req.user.role === 'staff' || req.user.role === 'barangay') && intervention.barangay_id !== req.user.barangay_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { rejection_reason, staff_notes } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    await intervention.update({
      status: 'Rejected',
      rejection_reason: rejection_reason.trim(),
      staff_notes: staff_notes || null,
      verified_by: req.user.id,
      verified_at: new Date()
    });

    // Notify beneficiary
    if (intervention.Beneficiary && intervention.Beneficiary.User) {
      await Notification.create({
        user_id: intervention.Beneficiary.user_id,
        type: 'intervention_rejected',
        title: 'Intervention Rejected',
        message: `Your intervention report for ${intervention.assistance_type} from ${intervention.agency_name} was rejected. Reason: ${rejection_reason}`,
        is_read: false
      });
    }

    res.json({
      success: true,
      message: 'Intervention rejected',
      data: intervention
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/interventions/stats ── Get intervention statistics (Admin/Staff)
router.get('/stats', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const where = {};

    // Staff can only see stats from their barangay
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      where.barangay_id = req.user.barangay_id;
    }

    const [total, pending, verified, rejected] = await Promise.all([
      Intervention.count({ where }),
      Intervention.count({ where: { ...where, status: 'Pending' } }),
      Intervention.count({ where: { ...where, status: 'Verified' } }),
      Intervention.count({ where: { ...where, status: 'Rejected' } })
    ]);

    const verifiedInterventions = await Intervention.findAll({
      where: { ...where, status: 'Verified' },
      attributes: ['amount']
    });

    const totalAmount = verifiedInterventions.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

    // Get top agencies
    const agencyStats = await Intervention.findAll({
      where: { ...where, status: 'Verified' },
      attributes: [
        'agency_name',
        [Intervention.sequelize.fn('COUNT', Intervention.sequelize.col('id')), 'count'],
        [Intervention.sequelize.fn('SUM', Intervention.sequelize.col('amount')), 'total_amount']
      ],
      group: ['agency_name'],
      order: [[Intervention.sequelize.fn('COUNT', Intervention.sequelize.col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    res.json({
      success: true,
      data: {
        total,
        pending,
        verified,
        rejected,
        total_amount: totalAmount,
        top_agencies: agencyStats
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
