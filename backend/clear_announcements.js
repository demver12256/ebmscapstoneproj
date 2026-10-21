const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { 
  Announcement, 
  AnnouncementRecipient, 
  Attendance, 
  SMSNotification, 
  Notification, 
  sequelize 
} = require('./db');
const { Op } = require('sequelize');

async function clearAnnouncements() {
  try {
    console.log('🗑️  Starting cleanup of all announcement data...\n');

    // Disable foreign key checks temporarily
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Delete all announcement recipients
    const arCount = await AnnouncementRecipient.count();
    await AnnouncementRecipient.destroy({ where: {}, force: true });
    try { await sequelize.query('ALTER TABLE announcement_recipients AUTO_INCREMENT = 1'); } catch (e) {}
    console.log(`✅ Deleted ${arCount} announcement recipient(s)`);

    // 2. Delete attendance records for announcements
    const attCount = await Attendance.count({ where: { [Op.or]: [{ announcement_id: { [Op.ne]: null } }, { event_name: { [Op.ne]: null } }] } });
    await Attendance.destroy({ where: { [Op.or]: [{ announcement_id: { [Op.ne]: null } }, { event_name: { [Op.ne]: null } }] }, force: true });
    try { await sequelize.query('ALTER TABLE attendances AUTO_INCREMENT = 1'); } catch (e) {}
    console.log(`✅ Deleted ${attCount} announcement attendance record(s)`);

    // 3. Delete announcement SMS notifications
    const smsCount = await SMSNotification.count({ 
      where: { 
        [Op.or]: [
          { announcement_id: { [Op.ne]: null } }, 
          { notification_type: { [Op.in]: ['announcement', 'announcement_absence'] } }
        ] 
      } 
    });
    await SMSNotification.destroy({ 
      where: { 
        [Op.or]: [
          { announcement_id: { [Op.ne]: null } }, 
          { notification_type: { [Op.in]: ['announcement', 'announcement_absence'] } }
        ] 
      }, 
      force: true 
    });
    console.log(`✅ Deleted ${smsCount} announcement SMS notification(s)`);

    // 4. Delete announcement system notifications
    const notifCount = await Notification.count({ 
      where: { 
        [Op.or]: [
          { reference_type: { [Op.like]: '%announcement%' } }, 
          { type: { [Op.like]: '%announcement%' } }
        ] 
      } 
    });
    await Notification.destroy({ 
      where: { 
        [Op.or]: [
          { reference_type: { [Op.like]: '%announcement%' } }, 
          { type: { [Op.like]: '%announcement%' } }
        ] 
      }, 
      force: true 
    });
    console.log(`✅ Deleted ${notifCount} announcement system notification(s)`);

    // 5. Delete all announcements
    const aCount = await Announcement.count();
    await Announcement.destroy({ where: {}, force: true });
    try { await sequelize.query('ALTER TABLE announcements AUTO_INCREMENT = 1'); } catch (e) {}
    console.log(`✅ Deleted ${aCount} announcement(s)`);

    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n✨ All announcement data has been cleared successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Announcements deleted: ${aCount}`);
    console.log(`   - Recipients deleted: ${arCount}`);
    console.log(`   - Attendances deleted: ${attCount}`);
    console.log(`   - SMS notifications deleted: ${smsCount}`);
    console.log(`   - System notifications deleted: ${notifCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing announcement data:', error);
    try { await sequelize.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) {}
    process.exit(1);
  }
}

clearAnnouncements();
