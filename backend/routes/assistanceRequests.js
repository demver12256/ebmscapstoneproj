const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { AssistanceRequest, Beneficiary, User, Barangay } = require('../db');

const router = express.Router();
router.use(authenticate);

// Helper to get effective barangay_id for a user
const getUserBarangayId = async (user) => {
  if (user.barangay_id) return user.barangay_id;
  if (user.role === 'beneficiary') {
    const ben = await Beneficiary.findOne({ where: { user_id: user.id } });
    if (ben && ben.barangay_id) return ben.barangay_id;
  }
  return null;
};

// GET /api/assistance-requests/stats — Summary counts by status
router.get('/stats', async (req, res, next) => {
  try {
    const currentUser = req.user;
    let whereClause = {};

    if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      const brgyId = await getUserBarangayId(currentUser);
      if (brgyId) whereClause.barangay_id = brgyId;
    } else if (currentUser.role === 'beneficiary') {
      whereClause.user_id = currentUser.id;
    }
    // admin sees all

    const statuses = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'];
    const counts = {};
    for (const status of statuses) {
      counts[status] = await AssistanceRequest.count({ where: { ...whereClause, status } });
    }
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

    res.json({ success: true, data: counts });
  } catch (error) {
    next(error);
  }
});

// GET /api/assistance-requests — List requests
router.get('/', async (req, res, next) => {
  try {
    const currentUser = req.user;
    let whereClause = {};

    if (currentUser.role === 'beneficiary') {
      // Beneficiary sees only their own requests
      whereClause.user_id = currentUser.id;
    } else if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      // Staff sees requests from their barangay only
      const brgyId = await getUserBarangayId(currentUser);
      if (brgyId) {
        whereClause.barangay_id = brgyId;
      } else {
        return res.json({ success: true, data: [] });
      }
    }
    // Admin sees all

    // Apply filters from query params
    if (req.query.status && req.query.status !== 'all') {
      whereClause.status = req.query.status;
    }
    if (req.query.type && req.query.type !== 'all') {
      whereClause.type = req.query.type;
    }
    if (req.query.priority && req.query.priority !== 'all') {
      whereClause.priority = req.query.priority;
    }

    const requests = await AssistanceRequest.findAll({
      where: whereClause,
      include: [
        {
          model: Beneficiary,
          attributes: ['id', 'first_name', 'last_name', 'category', 'profile_picture'],
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
        },
        {
          model: User,
          attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
        },
        {
          model: Barangay,
          attributes: ['id', 'barangay_name'],
        },
        {
          model: User,
          as: 'Reviewer',
          attributes: ['id', 'first_name', 'last_name', 'role'],
        },
      ],
      order: [
        ['status', 'ASC'],
        ['priority', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistance-requests — Beneficiary creates a new request
router.post('/', async (req, res, next) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'beneficiary') {
      return res.status(403).json({ success: false, message: 'Only beneficiaries can submit assistance requests.' });
    }

    // Check beneficiary is approved
    const ben = await Beneficiary.findOne({ where: { user_id: currentUser.id } });
    if (!ben || ben.status !== 'Approved') {
      return res.status(403).json({ success: false, message: 'Your beneficiary registration must be approved first.' });
    }

    const { type, subject, description, priority } = req.body;

    if (!type || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Type, subject, and description are required.' });
    }

    const request = await AssistanceRequest.create({
      beneficiary_id: ben.id,
      user_id: currentUser.id,
      barangay_id: ben.barangay_id,
      type,
      subject: subject.trim(),
      description: description.trim(),
      priority: priority || 'Normal',
      status: 'Pending',
    });

    res.status(201).json({ success: true, data: request, message: 'Assistance request submitted successfully.' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/assistance-requests/:id/status — Admin/Staff updates request status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const currentUser = req.user;

    if (!['admin','mswdo_admin','staff','barangay'].includes(currentUser.role)) {
      return res.status(403).json({ success: false, message: 'Only admin or staff can update assistance requests.' });
    }

    const request = await AssistanceRequest.findByPk(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    // Staff can only update requests from their barangay
    if (currentUser.role === 'staff' || currentUser.role === 'barangay') {
      const brgyId = await getUserBarangayId(currentUser);
      if (request.barangay_id !== brgyId) {
        return res.status(403).json({ success: false, message: 'You can only manage requests from your barangay.' });
      }
    }

    const { status, admin_notes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const validStatuses = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    request.status = status;
    if (admin_notes !== undefined) {
      request.admin_notes = admin_notes;
    }
    request.reviewed_by = currentUser.id;
    request.reviewed_at = new Date();
    await request.save();

    // Reload with associations
    const updated = await AssistanceRequest.findByPk(request.id, {
      include: [
        {
          model: Beneficiary,
          attributes: ['id', 'first_name', 'last_name', 'category'],
          include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
        },
        {
          model: User,
          attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
        },
        {
          model: Barangay,
          attributes: ['id', 'barangay_name'],
        },
        {
          model: User,
          as: 'Reviewer',
          attributes: ['id', 'first_name', 'last_name', 'role'],
        },
      ],
    });

    res.json({ success: true, data: updated, message: `Request ${status.toLowerCase()} successfully.` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
