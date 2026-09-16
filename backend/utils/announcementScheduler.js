const { Op } = require('sequelize');
const {
  Announcement,
  AnnouncementRecipient,
  Beneficiary,
  User,
  Barangay,
  Notification,
  SMSNotification,
  AuditLog,
} = require('../db');

function parseDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  let hours = 23;
  let minutes = 59;

  if (timeStr) {
    const timeMatch = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      hours = h;
      minutes = m;
    }
  }

  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hours, minutes, 59);
}

/**
 * Checks all announcements whose event date/time or expiration has passed, or are completed.
 * Automatically:
 * - Updates pending recipients to 'Absent'
 * - Creates 'announcement_absence' notifications for any absent beneficiaries who have not yet received one
 * - Updates announcement status to 'completed'
 */
async function autoCompleteExpiredAnnouncements() {
  try {
    const now = new Date();

    const announcementsToCheck = await Announcement.findAll({
      where: {
        status: { [Op.in]: ['published', 'completed'] },
      },
    });

    for (const ann of announcementsToCheck) {
      const timeToCheck = ann.end_time || ann.event_time || '23:59';
      const expireTime = parseDateTime(ann.event_date, timeToCheck);

      const isPastEvent = expireTime && now >= expireTime;
      const isPastExpiration = ann.expiration_date && now > parseDateTime(ann.expiration_date, '23:59');
      const isCompleted = ann.status === 'completed';

      if (isPastEvent || isPastExpiration || isCompleted) {
        // Mark any pending recipients as absent
        const [absentCount] = await AnnouncementRecipient.update(
          { attendance_status: 'Absent' },
          {
            where: {
              announcement_id: ann.id,
              attendance_status: 'Pending',
            },
          }
        );

        if (absentCount > 0) {
          console.log(`⏰ Announcement ID ${ann.id} ("${ann.title}"): Marked ${absentCount} pending beneficiaries as Absent.`);
        }

        // Fetch all absent recipients to verify each has an absence notification
        const absentRecipients = await AnnouncementRecipient.findAll({
          where: {
            announcement_id: ann.id,
            attendance_status: 'Absent',
          },
          include: [
            {
              model: Beneficiary,
              as: 'Beneficiary',
              include: [
                { model: User, attributes: ['id', 'email', 'contact_number'] },
                { model: Barangay, attributes: ['barangay_name'] },
              ],
            },
          ],
        });

        const inAppNotifications = [];
        const smsNotifications = [];

        for (const recipient of absentRecipients) {
          const b = recipient.Beneficiary;
          if (!b || !b.User) continue;

          const existingNotif = await Notification.findOne({
            where: {
              user_id: b.User.id,
              reference_id: ann.id,
              reference_type: 'announcement_absence',
            },
          });

          if (!existingNotif) {
            inAppNotifications.push({
              user_id: b.User.id,
              title: `Paunawa: Hindi Naka-attend sa ${ann.title}`,
              message: `Ikaw ay naitalang HINDI NAKADALO (Absent) sa aktibidad na "${ann.title}" noong ${ann.event_date || 'N/A'}${ann.event_time ? ` (${ann.event_time})` : ''}. Mangyaring makipag-ugnayan sa Tanggapan ng DSWD/MSWDO o sa inyong Barangay Staff kung may balidong dahilan.`,
              type: 'announcement_absence',
              reference_id: ann.id,
              reference_type: 'announcement_absence',
              is_read: false,
            });
          }

          if (b.contact_number && absentCount > 0) {
            smsNotifications.push({
              beneficiary_id: b.id,
              phone_number: b.contact_number,
              message: `[EBMS] Ikaw ay naitalang HINDI NAKADALO (Absent) sa aktibidad "${ann.title}" noong ${ann.event_date || 'N/A'}. Makipag-ugnayan sa DSWD/MSWDO para sa detalye.`,
              status: 'sent',
              sent_at: new Date(),
            });
          }
        }

        if (inAppNotifications.length > 0) {
          await Notification.bulkCreate(inAppNotifications, { ignoreDuplicates: true });
        }
        if (smsNotifications.length > 0) {
          await SMSNotification.bulkCreate(smsNotifications, { ignoreDuplicates: true });
        }

        if (ann.status === 'published') {
          await ann.update({ status: 'completed' });
          await AuditLog.create({
            user_id: ann.created_by_user_id || 1,
            action: `AUTO_COMPLETED_ACTIVITY: "${ann.title}" - Activity concluded, absentees updated`,
            module: 'Announcements',
            timestamp: new Date(),
          });
        }
      }
    }
  } catch (err) {
    console.error('Error in autoCompleteExpiredAnnouncements:', err);
  }
}

module.exports = {
  parseDateTime,
  autoCompleteExpiredAnnouncements,
};
