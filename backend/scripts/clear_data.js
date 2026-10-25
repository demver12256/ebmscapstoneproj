require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const {
  sequelize,
  User,
  Beneficiary,
  BeneficiaryDocument,
  BenefitProgram,
  Enrollment,
  DistributionEvent,
  DistributionTransaction,
  Attendance,
  SMSNotification,
  AuditLog,
  Message,
  Notification,
  Announcement,
  AnnouncementRecipient,
  Otp,
  AssistanceRequest,
  MedicalAssistanceApplication,
  MedicalAssistanceDocument,
  Intervention,
  Barangay
} = require('../db');
const { Op } = require('sequelize');

async function clearData() {
  console.log('====================================================');
  console.log('🧹 STARTING DATABASE CLEANUP: ZERO TRANSACTIONS/DATA');
  console.log('====================================================\n');

  try {
    // 1. Temporarily disable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✓ Foreign key checks disabled temporarily.\n');

    // 2. Clear Announcements
    const annRecipCount = await AnnouncementRecipient.count();
    await AnnouncementRecipient.destroy({ where: {}, force: true });
    const annCount = await Announcement.count();
    await Announcement.destroy({ where: {}, force: true });
    console.log(`[Announcements] Deleted ${annRecipCount} recipient(s) and ${annCount} announcement(s).`);

    // 3. Clear Assistance Requests, Medical Assistance & Interventions
    const assistCount = await AssistanceRequest.count();
    await AssistanceRequest.destroy({ where: {}, force: true });
    const medDocCount = await MedicalAssistanceDocument.count();
    await MedicalAssistanceDocument.destroy({ where: {}, force: true });
    const medAppCount = await MedicalAssistanceApplication.count();
    await MedicalAssistanceApplication.destroy({ where: {}, force: true });
    const intervCount = await Intervention.count();
    await Intervention.destroy({ where: {}, force: true });
    console.log(`[Assistance & Interventions] Deleted ${assistCount} assistance request(s), ${medAppCount} medical application(s), ${medDocCount} medical doc(s), ${intervCount} intervention(s).`);

    // 4. Clear Distributions & Attendance
    const distTxCount = await DistributionTransaction.count();
    await DistributionTransaction.destroy({ where: {}, force: true });
    const distEventCount = await DistributionEvent.count();
    await DistributionEvent.destroy({ where: {}, force: true });
    const attCount = await Attendance.count();
    await Attendance.destroy({ where: {}, force: true });
    console.log(`[Distributions] Deleted ${distTxCount} transaction(s), ${distEventCount} event(s), and ${attCount} attendance record(s).`);

    // 5. Clear Programs & Enrollments
    const enrollCount = await Enrollment.count();
    await Enrollment.destroy({ where: {}, force: true });
    const progCount = await BenefitProgram.count();
    await BenefitProgram.destroy({ where: {}, force: true });
    console.log(`[Programs] Deleted ${enrollCount} enrollment(s) and ${progCount} program(s).`);

    // 6. Clear Beneficiary Profiles & Documents
    const benDocCount = await BeneficiaryDocument.count();
    await BeneficiaryDocument.destroy({ where: {}, force: true });
    const benCount = await Beneficiary.count();
    await Beneficiary.destroy({ where: {}, force: true });
    console.log(`[Beneficiaries] Deleted ${benCount} beneficiary record(s) and ${benDocCount} document(s).`);

    // 7. Clear Messages, Notifications, SMS & OTPs
    const msgCount = await Message.count();
    await Message.destroy({ where: {}, force: true });
    const notifCount = await Notification.count();
    await Notification.destroy({ where: {}, force: true });
    const smsCount = await SMSNotification.count();
    await SMSNotification.destroy({ where: {}, force: true });
    const otpCount = await Otp.count();
    await Otp.destroy({ where: {}, force: true });
    console.log(`[Messages & Notifs] Deleted ${msgCount} message(s), ${notifCount} notification(s), ${smsCount} SMS, ${otpCount} OTP(s).`);

    // 8. Clear System Logs (AuditLog)
    const auditCount = await AuditLog.count();
    await AuditLog.destroy({ where: {}, force: true });
    console.log(`[System Logs] Deleted ${auditCount} audit log record(s).`);

    // 9. Delete Beneficiary User Accounts (Leave Default Admin & Staff Accounts)
    const deletedUsers = await User.destroy({
      where: {
        role: 'beneficiary'
      },
      force: true
    });
    console.log(`[Users] Deleted ${deletedUsers} beneficiary user account(s).`);

    // 10. Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n✓ Foreign key checks re-enabled.');

    // 11. Clean up test uploaded documents from disk (preserve folder structure and sample files)
    const uploadDirs = [
      path.resolve(__dirname, '../uploads/documents'),
      path.resolve(__dirname, '../uploads/documents/assistance'),
      path.resolve(__dirname, '../uploads/documents/medical'),
      path.resolve(__dirname, '../uploads/interventions')
    ];

    let deletedFilesCount = 0;
    uploadDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(f => {
          const filePath = path.join(dir, f);
          const stat = fs.statSync(filePath);
          if (stat.isFile() && !f.startsWith('sample-') && f !== '.gitkeep') {
            fs.unlinkSync(filePath);
            deletedFilesCount++;
          }
        });
      }
    });
    console.log(`[Storage] Deleted ${deletedFilesCount} uploaded test file(s) from disk.`);

    // 12. Verification & Summary of Remaining Data
    console.log('\n====================================================');
    console.log('📊 CURRENT DATABASE STATUS AFTER CLEANUP');
    console.log('====================================================');

    const counts = {
      'Beneficiaries': await Beneficiary.count(),
      'Beneficiary Documents': await BeneficiaryDocument.count(),
      'Benefit Programs': await BenefitProgram.count(),
      'Enrollments': await Enrollment.count(),
      'Distribution Events': await DistributionEvent.count(),
      'Distribution Transactions': await DistributionTransaction.count(),
      'Attendances': await Attendance.count(),
      'Announcements': await Announcement.count(),
      'Announcement Recipients': await AnnouncementRecipient.count(),
      'Assistance Requests': await AssistanceRequest.count(),
      'Medical Applications': await MedicalAssistanceApplication.count(),
      'Medical Documents': await MedicalAssistanceDocument.count(),
      'Interventions': await Intervention.count(),
      'Messages': await Message.count(),
      'Notifications': await Notification.count(),
      'SMS Notifications': await SMSNotification.count(),
      'Audit Logs': await AuditLog.count(),
      'Barangays (Master List)': await Barangay.count(),
      'Remaining Staff/Admin Users': await User.count()
    };

    console.table(counts);

    const remainingUsers = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'first_name', 'last_name']
    });

    console.log('\n🔐 INTACT DEFAULT ADMIN & STAFF ACCOUNTS:');
    console.table(remainingUsers.map(u => ({
      ID: u.id,
      Username: u.username || '—',
      Email: u.email || '—',
      Role: u.role,
      Name: `${u.first_name} ${u.last_name}`
    })));

    console.log('\n✨ ZERO DATA CLEANUP COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {}
    process.exit(1);
  }
}

clearData();
