const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { AuditLog, User } = require('../db');

const router = express.Router();
router.use(authenticate);
router.use(authorize('admin'));

router.get('/', async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({ include: [{ model: User, attributes: ['id', 'first_name', 'last_name', 'email'] }], order: [['timestamp', 'DESC']] });
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
