require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Notification, User, Announcement, AnnouncementRecipient } = require('../db');

async function setup() {
  const user = await User.findOne({ where: { first_name: 'Jaymar', last_name: 'Macailao' } });
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  const ann66 = await Announcement.findByPk(66);
  console.log('Ann 66:', ann66?.title, ann66?.status, ann66?.event_date);

  let notif = await Notification.findOne({
    where: {
      user_id: user.id,
      reference_id: 66,
      reference_type: 'announcement_absence',
    },
  });

  const msg = `Ikaw ay naitalang HINDI NAKADALO (Absent) sa aktibidad na "${ann66.title}" noong ${ann66.event_date} (08:30). Mangyaring makipag-ugnayan sa Tanggapan ng DSWD/MSWDO o sa inyong Barangay Staff kung may balidong dahilan.`;

  if (notif) {
    await notif.update({
      title: `Paunawa: Hindi Naka-attend sa ${ann66.title}`,
      message: msg,
      type: 'announcement_absence',
      is_read: false,
    });
    console.log('Updated existing absence notif to unread:', notif.id);
  } else {
    notif = await Notification.create({
      user_id: user.id,
      title: `Paunawa: Hindi Naka-attend sa ${ann66.title}`,
      message: msg,
      type: 'announcement_absence',
      reference_id: 66,
      reference_type: 'announcement_absence',
      is_read: false,
    });
    console.log('Created new unread absence notif:', notif.id);
  }

  process.exit(0);
}

setup();
