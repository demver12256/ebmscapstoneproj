const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { SMSNotification, Beneficiary, Barangay, Announcement, sequelize } = require('../db');
const { sendNotification } = require('../utils/smsDispatcher');

const router = express.Router();
router.use(authenticate);

// GET /api/sms — List SMS notification logs with pagination, search, and status filters
router.get('/', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    const isBeneficiary = req.user.role === 'beneficiary';
    const { page = 1, limit = 15, status, search, start_date, end_date } = req.query;

    const where = {};
    if (isBeneficiary) {
      const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id }, attributes: ['id'] });
      where.beneficiary_id = beneficiary?.id || 0;
    } else {
      if (status && status !== 'all') {
        where.status = status;
      }
      if (start_date && end_date) {
        where.createdAt = { [Op.between]: [start_date, end_date] };
      } else if (start_date) {
        where.createdAt = { [Op.gte]: start_date };
      } else if (end_date) {
        where.createdAt = { [Op.lte]: end_date };
      }
      if (search) {
        where[Op.or] = [
          { phone_number: { [Op.like]: `%${search}%` } },
          { message: { [Op.like]: `%${search}%` } },
          { failure_reason: { [Op.like]: `%${search}%` } },
          sequelize.where(
            sequelize.fn('concat', sequelize.col('Beneficiary.first_name'), ' ', sequelize.col('Beneficiary.last_name')),
            { [Op.like]: `%${search}%` }
          ),
        ];
      }
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await SMSNotification.findAndCountAll({
      where,
      include: isBeneficiary
        ? []
        : [
            {
              model: Beneficiary,
              attributes: ['id', 'first_name', 'last_name', 'contact_number'],
              include: [{ model: Barangay, attributes: ['id', 'barangay_name'] }],
              required: false,
            },
            {
              model: Announcement,
              attributes: ['id', 'title'],
              required: false,
            },
          ],
      order: [['id', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    // Compute stats for admin/staff
    let stats = null;
    if (!isBeneficiary) {
      const [totalCount, sentCount, failedCount, queuedCount] = await Promise.all([
        SMSNotification.count(),
        SMSNotification.count({ where: { status: 'sent' } }),
        SMSNotification.count({ where: { status: 'failed' } }),
        SMSNotification.count({ where: { status: 'queued' } }),
      ]);
      stats = {
        total: totalCount,
        sent: sentCount,
        failed: failedCount,
        queued: queuedCount,
      };
    }

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)) || 1,
      },
      stats,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sms — Queue a new SMS
router.post('/', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const { beneficiary_id, message } = req.body;
    if (!beneficiary_id || !String(message || '').trim()) {
      return res.status(400).json({ success: false, message: 'Beneficiary and message are required.' });
    }
    const beneficiary = await Beneficiary.findByPk(beneficiary_id);
    if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary not found.' });
    if (!beneficiary.contact_number) {
      return res.status(400).json({ success: false, message: 'Beneficiary has no mobile number on file.' });
    }

    const notification = await SMSNotification.create({
      beneficiary_id,
      phone_number: beneficiary.contact_number,
      message,
      status: 'queued',
    });

    // Try sending immediately in background
    sendNotification(notification).catch(err => console.error('[SMS send error]:', err.message));

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

// POST /api/sms/:id/resend — Resend a failed or queued SMS
router.post('/:id/resend', authorize('admin'), async (req, res, next) => {
  try {
    const notification = await SMSNotification.findByPk(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'SMS record not found.' });
    }

    await notification.update({
      status: 'queued',
      failure_reason: null,
    });

    // Trigger dispatch
    await sendNotification(notification);
    await notification.reload();

    res.json({
      success: true,
      message: notification.status === 'sent' ? 'SMS sent successfully.' : 'SMS dispatch processed.',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
