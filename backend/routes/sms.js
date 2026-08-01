const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { SMSNotification } = require('../db');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'staff', 'barangay', 'beneficiary'), async (req, res, next) => {
  try {
    const where = req.user.role === 'beneficiary' ? { beneficiary_id: req.user.id } : {};
    const messages = await SMSNotification.findAll({ where });
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const { beneficiary_id, message } = req.body;
    const notification = await SMSNotification.create({
      beneficiary_id,
      message,
      status: 'sent',
      sent_at: new Date(),
    });
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
