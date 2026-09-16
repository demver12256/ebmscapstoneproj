const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Notification, Announcement } = require('../db');

async function test() {
  const notifs = await Notification.findAll({
    where: { user_id: [106, 108, 4216] },
    order: [['id', 'DESC']],
    limit: 20
  });
  console.log('Recent Notifications for staff:');
  notifs.forEach(n => {
    console.log(`ID: ${n.id} | User: ${n.user_id} | Title: ${n.title} | Ref: ${n.reference_type} #${n.reference_id} | Date: ${n.created_at}`);
  });
}
test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
