const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { Notification, Beneficiary, AnnouncementRecipient, Announcement } = require('../db');
const { checkAndProcessExpiredDistributions } = require('../utils/distributionScheduler');
const { autoCompleteExpiredAnnouncements } = require('../utils/announcementScheduler');

const router = express.Router();
router.use(authenticate);

function parseTargetBarangayIds(input) {
  if (!input) return [];
  let bIds = [];
  if (typeof input === 'string') {
    try { bIds = JSON.parse(input); } catch (e) { bIds = [input]; }
  } else if (Array.isArray(input)) {
    bIds = input;
  } else {
    bIds = [input];
  }
  if (!Array.isArray(bIds)) bIds = [bIds];
  return bIds.map(Number).filter((id) => !isNaN(id) && id > 0);
}

// ── GET / ── Get user's notifications
router.get('/', async (req, res, next) => {
  try {
    await Promise.all([
      checkAndProcessExpiredDistributions().catch((e) => console.error('Error in checkAndProcessExpiredDistributions:', e)),
      autoCompleteExpiredAnnouncements().catch((e) => console.error('Error in autoCompleteExpiredAnnouncements:', e)),
    ]);
    let notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    // Guard for Barangay Staff: Strictly verify announcement_staff notifications belong to their barangay
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      const userBarangayId = req.user.barangay_id ? Number(req.user.barangay_id) : null;
      const validNotifications = [];
      const invalidNotifIds = [];

      for (const n of notifications) {
        if (n.reference_type === 'announcement_staff' && n.reference_id) {
          const ann = await Announcement.findByPk(n.reference_id);
          if (!ann) {
            invalidNotifIds.push(n.id);
            continue;
          }
          const targetIds = parseTargetBarangayIds(ann.target_barangays);
          if (!userBarangayId || !targetIds.includes(userBarangayId)) {
            invalidNotifIds.push(n.id);
            continue;
          }
        }
        validNotifications.push(n);
      }

      if (invalidNotifIds.length > 0) {
        await Notification.destroy({ where: { id: invalidNotifIds } });
      }
      notifications = validNotifications;
    }

    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

// ── GET /unread-count ── Get unread notification count
router.get('/unread-count', async (req, res, next) => {
  try {
    await Promise.all([
      checkAndProcessExpiredDistributions().catch((e) => console.error('Error in checkAndProcessExpiredDistributions:', e)),
      autoCompleteExpiredAnnouncements().catch((e) => console.error('Error in autoCompleteExpiredAnnouncements:', e)),
    ]);

    // Clean up any stray staff notifications before counting
    if (req.user.role === 'staff' || req.user.role === 'barangay') {
      const userBarangayId = req.user.barangay_id ? Number(req.user.barangay_id) : null;
      const unreadStaffNotifs = await Notification.findAll({
        where: { user_id: req.user.id, is_read: false, reference_type: 'announcement_staff' },
      });
      const invalidNotifIds = [];
      for (const n of unreadStaffNotifs) {
        const ann = await Announcement.findByPk(n.reference_id);
        if (!ann || !userBarangayId || !parseTargetBarangayIds(ann.target_barangays).includes(userBarangayId)) {
          invalidNotifIds.push(n.id);
        }
      }
      if (invalidNotifIds.length > 0) {
        await Notification.destroy({ where: { id: invalidNotifIds } });
      }
    }

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
