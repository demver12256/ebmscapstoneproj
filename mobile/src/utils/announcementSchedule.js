// Mirrors frontend/src/utils/announcementSchedule.js so mobile uses the same
// "active for attendance" rules as the web RFID Attendance Scanner.

const parseClock = (value) => {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (!match) return null;

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

const pad = (n, len = 2) => String(n).padStart(len, '0');

export const getAnnouncementEndDateTime = (announcement) => {
  if (!announcement?.event_date) return null;

  const [year, month, day] = String(announcement.event_date).split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;

  const datePart = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  const toPhilippineDate = (clock) =>
    new Date(`${datePart}T${pad(clock.hours)}:${pad(clock.minutes)}:${pad(clock.seconds)}+08:00`);

  const endClock = parseClock(announcement.end_time) || { hours: 23, minutes: 59, seconds: 59 };
  const endDate = toPhilippineDate(endClock);
  if (Number.isNaN(endDate.getTime())) return null;
  const startClock = parseClock(announcement.event_time);

  // If the configured end clock is earlier, the event ends the following day.
  if (startClock) {
    const startDate = toPhilippineDate(startClock);
    if (endDate < startDate) endDate.setTime(endDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return endDate;
};

export const getAnnouncementStartDateTime = (announcement) => {
  if (!announcement?.event_date) return null;
  const [year, month, day] = String(announcement.event_date).split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  const clock = parseClock(announcement.event_time) || { hours: 0, minutes: 0, seconds: 0 };
  const d = new Date(`${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(clock.hours)}:${pad(clock.minutes)}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Helper to determine if announcement is active (current or upcoming) for attendance recording
export const isAnnouncementActiveForAttendance = (ann) => {
  if (!ann) return false;
  if (ann.status === 'completed' || ann.status === 'archived') return false;
  if (ann.status !== 'published') return false;

  const now = new Date();
  const eventEndTime = getAnnouncementEndDateTime(ann);
  if (eventEndTime && now > eventEndTime) return false;

  if (ann.expiration_date) {
    const [y, m, d] = String(ann.expiration_date).split('T')[0].split('-').map(Number);
    if (y && m && d) {
      const expirationTime = new Date(y, m - 1, d, 23, 59, 59);
      if (now > expirationTime) return false;
    }
  }

  return true;
};

// 'current' = happening today / already started, 'upcoming' = future date
export const getAnnouncementTiming = (ann) => {
  if (!isAnnouncementActiveForAttendance(ann)) return 'ended';
  const start = getAnnouncementStartDateTime(ann);
  if (!start) return 'current';
  const now = new Date();
  const sameDay = start.toDateString() === now.toDateString();
  return start <= now || sameDay ? 'current' : 'upcoming';
};

