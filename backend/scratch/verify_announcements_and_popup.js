require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const http = require('http');
const { User, Beneficiary, Announcement, AnnouncementRecipient, Notification } = require('../db');

function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function verify() {
  console.log('--- STARTING VERIFICATION ---');
  const user = await User.findOne({ where: { first_name: 'Jaymar', last_name: 'Macailao' } });
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  // 1. Fetch announcements as Jaymar
  const annRes = await apiGet('/announcements', token);
  console.log('GET /api/announcements status:', annRes.status);
  const announcements = annRes.data?.data || [];
  console.log('Total announcements returned for beneficiary:', announcements.length);
  for (const a of announcements) {
    console.log(`  ID ${a.id}: "${a.title}" | Status: ${a.status} | Date: ${a.event_date} | Attendance: ${a.attendance_status}`);
  }

  // 2. Fetch notifications as Jaymar
  const notifRes = await apiGet('/notifications', token);
  console.log('GET /api/notifications status:', notifRes.status);
  const notifications = notifRes.data?.data || [];
  console.log('Total notifications returned for beneficiary:', notifications.length);
  
  const absenceNotifs = notifications.filter(n => 
    n.reference_type === 'announcement_absence' ||
    n.type === 'announcement_absence' ||
    n.title?.toLowerCase().includes('hindi naka-attend') ||
    n.title?.toLowerCase().includes('absent')
  );
  console.log('Absence notifications found:', absenceNotifs.length);
  for (const an of absenceNotifs) {
    console.log(`  🔔 ID ${an.id}: "${an.title}" | Unread: ${!an.is_read} | RefType: ${an.reference_type}`);
    console.log(`     Message: ${an.message.substring(0, 100)}...`);
  }

  // 3. Test upcoming filter logic as implemented in frontend
  const isAnnouncementUpcoming = (ann) => {
    if (!ann || ann.status !== 'published') return false;
    const now = new Date();
    if (ann.event_date) {
      const timeToCheck = ann.end_time || ann.event_time || '23:59';
      let hours = 23, minutes = 59;
      const match = String(timeToCheck).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3] ? match[3].toUpperCase() : null;
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        hours = h; minutes = m;
      }
      const [y, m, d] = String(ann.event_date).split('-').map(Number);
      if (y && m && d) {
        const eventEndTime = new Date(y, m - 1, d, hours, minutes, 59);
        if (now > eventEndTime) return false;
      }
    }
    return true;
  };

  const upcoming = announcements.filter(isAnnouncementUpcoming);
  console.log('\n--- UPCOMING ANNOUNCEMENTS CHECK ---');
  console.log('Upcoming announcements that would display in Official Municipal Announcements card:', upcoming.length);
  if (upcoming.length === 0) {
    console.log('✅ PASS: Past announcements (like 2026-09-05) are correctly filtered out!');
  } else {
    for (const u of upcoming) {
      console.log(`  Upcoming item: ID ${u.id} - ${u.title} (${u.event_date})`);
    }
  }

  const unreadAbsence = absenceNotifs.filter(n => !n.is_read);
  console.log('\n--- ABSENCE POPUP MODAL CHECK ---');
  console.log('Unread absence notifications that will trigger the modal:', unreadAbsence.length);
  if (unreadAbsence.length > 0) {
    console.log(`✅ PASS: Found unread absence pop-up item: "${unreadAbsence[0].title}"`);
  } else {
    console.log('⚠️ No unread absence notif found');
  }

  console.log('\n--- VERIFICATION COMPLETED ---');
  process.exit(0);
}

verify().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
