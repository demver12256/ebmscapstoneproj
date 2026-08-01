const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Attendance } = require('../db');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const attendance = await Attendance.findAll();
    res.json({ success: true, data: attendance });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const { beneficiary_id, RFID_number, event_name, attendance_date } = req.body;
    const exists = await Attendance.findOne({ where: { beneficiary_id, RFID_number, event_name, attendance_date } });
    if (exists) {
      return res.status(409).json({ message: 'Duplicate attendance entry detected' });
    }
    const record = await Attendance.create(req.body);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    await Attendance.update(req.body, { where: { id: req.params.id } });
    const record = await Attendance.findByPk(req.params.id);
    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await Attendance.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Attendance entry deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
