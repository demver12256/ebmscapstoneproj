const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { Notification, Beneficiary, AnnouncementRecipient } = require('../db');

const router = express.Router();
router.use(authenticate);

// ── GET / ── Get user's notifications
router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

// ── GET /unread-count ── Get unread notification count
router.get('/unread-count', async (req, res, next) => {
  try {
    let count = await Notification.count({
      where: { user_id: req.user.id, is_read: false },
    });

    if (req.user.role === 'beneficiary') {
      const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (beneficiary) {
        const unreadAnnCount = await AnnouncementRecipient.count({
          where: { beneficiary_id: beneficiary.id, is_read: false },
        });
        const unreadNotifAnnCount = await Notification.count({
          where: { user_id: req.user.id, is_read: false, reference_type: 'announcement' },
        });
        const extraUnreadAnnouncements = Math.max(0, unreadAnnCount - unreadNotifAnnCount);
        count += extraUnreadAnnouncements;
      }
    }

    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /:id/read ── Mark as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    await notification.update({ is_read: true });

    if (notification.reference_type === 'announcement' && notification.reference_id) {
      const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (beneficiary) {
        await AnnouncementRecipient.update(
          { is_read: true, read_at: new Date() },
          { where: { beneficiary_id: beneficiary.id, announcement_id: notification.reference_id, is_read: false } }
        );
      }
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /mark-all-read ── Mark all as read
router.patch('/mark-all-read', async (req, res, next) => {
  try {
    await Notification.update(
      { is_read: true },
      { where: { user_id: req.user.id, is_read: false } }
    );

    if (req.user.role === 'beneficiary') {
      const beneficiary = await Beneficiary.findOne({ where: { user_id: req.user.id } });
      if (beneficiary) {
        await AnnouncementRecipient.update(
          { is_read: true, read_at: new Date() },
          { where: { beneficiary_id: beneficiary.id, is_read: false } }
        );
      }
    }

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
