const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { Attendance, Announcement } = require('../db');
const { parseDateTime } = require('../utils/announcementScheduler');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'staff', 'barangay'), async (req, res, next) => {
  try {
    const where = {};
    if (req.user.role === 'mswdo_admin') {
      const mswdoAnnouncements = await Announcement.findAll({
        where: { created_by_user_id: req.user.id },
        attributes: ['id'],
      });
      const mswdoAnnIds = mswdoAnnouncements.map((a) => a.id);
      where.announcement_id = mswdoAnnIds;
    }
    const attendance = await Attendance.findAll({ where });
    res.json({ success: true, data: attendance });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin', 'staff'), async (req, res, next) => {
  try {
    const { beneficiary_id, RFID_number, event_name, attendance_date, announcement_id } = req.body;

    // Verify if linked to an announcement and if that announcement has ended
    let ann = null;
    if (announcement_id) {
      ann = await Announcement.findByPk(announcement_id);
    } else if (event_name) {
      ann = await Announcement.findOne({ where: { title: event_name } });
    }

    if (ann) {
      const timeToCheck = ann.end_time || ann.event_time || '23:59';
      const expireTime = parseDateTime(ann.event_date, timeToCheck);
      const isPastEvent = expireTime && new Date() >= expireTime;
      const isPastExpiration = ann.expiration_date && new Date() > parseDateTime(ann.expiration_date, '23:59');
      const isEnded = ann.status === 'completed' || ann.status === 'archived' || isPastEvent || isPastExpiration;

      if (isEnded) {
        if (ann.status !== 'completed' && ann.status !== 'archived') {
          await ann.update({ status: 'completed' });
        }
        return res.status(400).json({
          message: `BAWAL NA ANG ATTENDANCE: Ang aktibidad na "${ann.title}" ay tapos na. Hindi na maaaring magtala ng attendance ang staff.`,
          is_ended: true,
        });
      }
    }

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
