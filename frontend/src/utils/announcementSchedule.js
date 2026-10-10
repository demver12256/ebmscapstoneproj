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

export const getAnnouncementEndDateTime = (announcement) => {
  if (!announcement?.event_date) return null;

  const [year, month, day] = String(announcement.event_date).split('-').map(Number);
  if (!year || !month || !day) return null;

  const datePart = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const toPhilippineDate = (clock) => new Date(
    `${datePart}T${String(clock.hours).padStart(2, '0')}:${String(clock.minutes).padStart(2, '0')}:${String(clock.seconds).padStart(2, '0')}+08:00`
  );
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
