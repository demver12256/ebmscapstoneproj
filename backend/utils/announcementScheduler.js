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

let autoCompleteInProgress = false;

function parseDateTime(dateStr, timeStr, startTimeStr = null) {
  if (!dateStr) return null;
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return null;

  const parseClock = (value, fallback) => {
    if (!value) return fallback;
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
    if (!match) return fallback;

    let hours = parseInt(match[1], 10);
    const ampm = match[4] ? match[4].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return {
      hours,
      minutes: parseInt(match[2], 10),
      seconds: match[3] ? parseInt(match[3], 10) : 59,
    };
  };

  const datePart = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const toPhilippineDate = (clock) => new Date(
    `${datePart}T${String(clock.hours).padStart(2, '0')}:${String(clock.minutes).padStart(2, '0')}:${String(clock.seconds).padStart(2, '0')}+08:00`
  );
  const endClock = parseClock(timeStr, { hours: 23, minutes: 59, seconds: 59 });
  const endDate = toPhilippineDate(endClock);
  if (Number.isNaN(endDate.getTime())) return null;

  // An end time earlier than the start time means the event ends after midnight.
  const startClock = parseClock(startTimeStr, null);
  if (startClock) {
    const startDate = toPhilippineDate(startClock);
    if (endDate < startDate) endDate.setTime(endDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return endDate;
}

/**
 * Checks all announcements whose event date/time or expiration has passed, or are completed.
 * Automatically:
 * - Updates pending recipients to 'Absent'
 * - Creates 'announcement_absence' notifications for any absent beneficiaries who have not yet received one
 * - Updates announcement status to 'completed'
 */
async function autoCompleteExpiredAnnouncements() {
  if (autoCompleteInProgress) return;
  autoCompleteInProgress = true;

  try {
    const now = new Date();

    const announcementsToCheck = await Announcement.findAll({
      where: {
        status: { [Op.in]: ['published', 'completed'] },
      },
    });

    for (const ann of announcementsToCheck) {
      // event_time is the activity start time; without an end_time, keep attendance open through the day.
      const timeToCheck = ann.end_time || '23:59';
      const expireTime = parseDateTime(ann.event_date, timeToCheck, ann.event_time);

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
          if (!b) continue;

          const existingNotif = b.User
            ? await Notification.findOne({
                where: {
                  user_id: b.User.id,
                  reference_id: ann.id,
                  reference_type: 'announcement_absence',
                },
              })
            : null;

          if (b.User && !existingNotif) {
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

          const contactNumber = b.contact_number || b.User?.contact_number;
          const existingAbsenceSms = await SMSNotification.findOne({
            where: {
              announcement_id: ann.id,
              notification_type: 'announcement_absence',
              beneficiary_id: b.id,
            },
            attributes: ['id'],
          });
          if (contactNumber && !existingAbsenceSms) {
            smsNotifications.push({
              announcement_id: ann.id,
              notification_type: 'announcement_absence',
              beneficiary_id: b.id,
              phone_number: contactNumber,
              message: `[BeniAid DSWD Bongabong] Ikaw ay naitalang HINDI NAKADALO (Absent) sa aktibidad "${ann.title}" noong ${ann.event_date || 'N/A'}. Makipag-ugnayan sa DSWD/MSWDO para sa detalye.`,
              status: 'queued',
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
  } finally {
    autoCompleteInProgress = false;
  }
}

module.exports = {
  parseDateTime,
  autoCompleteExpiredAnnouncements,
};
