const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { SMSNotification, Beneficiary } = require('../db');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    let where = {};
    if (req.user.role === 'beneficiary') {
      const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id }, attributes: ['id'] });
      where = { beneficiary_id: beneficiary?.id || 0 };
    }
    const messages = await SMSNotification.findAll({ where });
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

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
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
