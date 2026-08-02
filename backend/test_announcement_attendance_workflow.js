const express = require('express');
const jwt = require('jsonwebtoken');
const {
  sequelize,
  User,
  Barangay,
  Beneficiary,
  BenefitProgram,
  Enrollment,
  Announcement,
  AnnouncementRecipient,
  Notification,
  AuditLog,
  Attendance,
} = require('./db');

const announcementsRouter = require('./routes/announcements');

// In-memory express server for automated evaluation
const app = express();
app.use(express.json());
app.use('/api/announcements', announcementsRouter);

async function runTest() {
  console.log('=====================================================================');
  console.log('🚀 TESTING INTEGRATED ANNOUNCEMENT & ATTENDANCE MANAGEMENT MODULE');
  console.log('=====================================================================\n');

  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: { drop: false } });

    // 1. Setup Admin User
    let admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      admin = await User.create({
        first_name: 'System',
        last_name: 'Admin',
        email: 'admin@ebms.local',
        password: 'Admin@123',
        role: 'admin',
        status: 'active',
      });
    }

    const adminToken = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'your-secret-key-for-ebms-jwt-token-2026');
    const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
    console.log('✅ Admin user ready:', admin.email);

    // 2. Setup Barangays (Anilao, Poblacion)
    const [brgyAnilao] = await Barangay.findOrCreate({ where: { barangay_name: 'Anilao' }, defaults: { barangay_name: 'Anilao' } });
    const [brgyPoblacion] = await Barangay.findOrCreate({ where: { barangay_name: 'Poblacion' }, defaults: { barangay_name: 'Poblacion' } });
    console.log('✅ Barangays initialized: Anilao ID', brgyAnilao.id, '| Poblacion ID', brgyPoblacion.id);

    // 3. Setup Barangay Staff assigned to Anilao
    let staffAnilao = await User.findOne({ where: { email: 'staff_anilao@ebms.local' } });
    if (!staffAnilao) {
      staffAnilao = await User.create({
        first_name: 'Barangay',
        last_name: 'Staff Anilao',
        email: 'staff_anilao@ebms.local',
        password: 'Password@123',
        role: 'barangay',
        barangay_id: brgyAnilao.id,
        status: 'active',
      });
    }
    const staffToken = jwt.sign({ id: staffAnilao.id, role: staffAnilao.role, barangay_id: staffAnilao.barangay_id }, process.env.JWT_SECRET || 'your-secret-key-for-ebms-jwt-token-2026');
    const staffHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` };
    console.log('✅ Staff user ready:', staffAnilao.email);

    // 4. Setup Benefit Programs (4Ps, Senior)
    const [prog4Ps] = await BenefitProgram.findOrCreate({ where: { name: '4Ps Program' }, defaults: { name: '4Ps Program', code: '4Ps', status: 'active' } });
    const [progSenior] = await BenefitProgram.findOrCreate({ where: { name: 'Senior Citizen Cash Assistance' }, defaults: { name: 'Senior Citizen Cash Assistance', code: 'SENIOR', status: 'active' } });
    console.log('✅ Programs initialized: 4Ps ID', prog4Ps.id, '| Senior ID', progSenior.id);

    // Helper to create test beneficiary + user + enrollment + RFID
    async function createTestBeneficiary(email, firstName, lastName, barangayId, programId, rfidCard, idCode) {
      let user = await User.findOne({ where: { email } });
      if (!user) {
        user = await User.create({
          first_name: firstName,
          last_name: lastName,
          email,
          password: 'Password@123',
          role: 'beneficiary',
          status: 'active',
        });
      }

      let ben = await Beneficiary.findOne({ where: { user_id: user.id } });
      if (!ben) {
        ben = await Beneficiary.create({
          user_id: user.id,
          first_name: firstName,
          last_name: lastName,
          sex: 'Female',
          birthdate: '1995-03-20',
          barangay_id: barangayId,
          status: 'Approved',
          RFID_number: rfidCard,
          beneficiary_id_code: idCode,
          contact_number: '09181234567',
        });
      } else {
        await ben.update({ barangay_id: barangayId, status: 'Approved', RFID_number: rfidCard, beneficiary_id_code: idCode });
      }

      if (programId) {
        await Enrollment.findOrCreate({
          where: { beneficiary_id: ben.id, program_id: programId },
          defaults: { beneficiary_id: ben.id, program_id: programId, status: 'active' },
        });
      }

      return { user, ben };
    }

    // Create test subjects matching scenario:
    // Ben A: 4Ps + Anilao (Targeted -> RFID: RFID_4PS_ANILAO_001)
    const benA = await createTestBeneficiary('benA@ebms.local', 'Maria', 'Santos', brgyAnilao.id, prog4Ps.id, 'RFID_4PS_ANILAO_001', 'BEN-ANILAO-001');
    // Ben B: 4Ps + Poblacion (Wrong barangay -> RFID: RFID_4PS_POB_002)
    const benB = await createTestBeneficiary('benB@ebms.local', 'Juan', 'Dela Cruz', brgyPoblacion.id, prog4Ps.id, 'RFID_4PS_POB_002', 'BEN-POB-002');
    // Ben C: Senior + Anilao (Wrong program -> RFID: RFID_SENIOR_ANILAO_003)
    const benC = await createTestBeneficiary('benC@ebms.local', 'Pedro', 'Reyes', brgyAnilao.id, progSenior.id, 'RFID_SENIOR_ANILAO_003', 'BEN-ANILAO-003');

    console.log('✅ Created 3 Test Beneficiaries with RFID cards.');

    // Start ephemeral server
    const server = app.listen(5098, async () => {
      const BASE = 'http://127.0.0.1:5098/api/announcements';

      // 5. Admin creates & publishes Announcement for 4Ps in Anilao
      console.log('\n--- STEP 1: ADMIN CREATES & PUBLISHES ANNOUNCEMENT ---');
      const payload = {
        title: '4Ps Family Development Session',
        message: 'All registered 4Ps beneficiaries of Barangay Anilao are required to attend the Family Development Session.',
        event_date: '2026-08-15',
        event_time: '9:00 AM',
        venue: 'Barangay Anilao Covered Court',
        priority: 'Urgent',
        status: 'published',
        target_programs: [prog4Ps.id],
        target_barangays: [brgyAnilao.id],
      };

      const createRes = await fetch(BASE, { method: 'POST', headers: adminHeaders, body: JSON.stringify(payload) });
      const createData = await createRes.json();
      const announcement = createData.data;
      console.log('📣 Published Announcement ID:', announcement.id, '| Recipient Count:', announcement.recipient_count);

      // Verify Staff Received Assignment Notification
      const staffNotifications = await Notification.findAll({ where: { user_id: staffAnilao.id, reference_type: 'announcement_staff' } });
      console.log(`📩 Staff Notification sent to ${staffAnilao.email}: ${staffNotifications.length > 0 ? '✅ YES' : '❌ NO'}`);

      // 6. Barangay Staff RFID Attendance Scanning
      console.log('\n--- STEP 2: BARANGAY STAFF RFID ATTENDANCE SCANNING ---');

      // Test 1: Scan Valid Target Beneficiary (Ben A - 4Ps Anilao)
      const scanARes = await fetch(`${BASE}/${announcement.id}/scan-rfid`, {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({ RFID_number: 'RFID_4PS_ANILAO_001' }),
      });
      const scanAData = await scanARes.json();
      console.log(`Scan 1 (Targeted Ben A): Status ${scanARes.status} | ${scanAData.message}`);

      // Test 2: Duplicate Scan for Ben A
      const scanDupRes = await fetch(`${BASE}/${announcement.id}/scan-rfid`, {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({ RFID_number: 'RFID_4PS_ANILAO_001' }),
      });
      const scanDupData = await scanDupRes.json();
      console.log(`Scan 2 (Duplicate Ben A): Status ${scanDupRes.status} | ${scanDupData.message}`);

      // Test 3: Scan Wrong Program Beneficiary (Ben C - Senior Anilao)
      const scanCRes = await fetch(`${BASE}/${announcement.id}/scan-rfid`, {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({ RFID_number: 'RFID_SENIOR_ANILAO_003' }),
      });
      const scanCData = await scanCRes.json();
      console.log(`Scan 3 (Wrong Program Ben C): Status ${scanCRes.status} | ${scanCData.message}`);

      // Test 4: Scan Wrong Barangay Beneficiary (Ben B - 4Ps Poblacion)
      const scanBRes = await fetch(`${BASE}/${announcement.id}/scan-rfid`, {
        method: 'POST',
        headers: staffHeaders,
        body: JSON.stringify({ RFID_number: 'RFID_4PS_POB_002' }),
      });
      const scanBData = await scanBRes.json();
      console.log(`Scan 4 (Wrong Barangay Ben B): Status ${scanBRes.status} | ${scanBData.message}`);

      // 7. Verify Real-time Stats & Export Report
      console.log('\n--- STEP 3: ATTENDANCE STATS & EXPORTABLE REPORT ---');
      const statsRes = await fetch(`${BASE}/${announcement.id}/attendance-stats`, { headers: adminHeaders });
      const statsData = await statsRes.json();
      console.log('📊 Live Attendance Stats:', statsData.data?.stats);

      const exportRes = await fetch(`${BASE}/${announcement.id}/export`, { headers: adminHeaders });
      const exportData = await exportRes.json();
      console.log('📄 Exported Report Rows Count:', exportData.report?.length);

      server.close();

      console.log('\n=====================================================================');
      if (scanARes.status === 200 && scanDupRes.status === 409 && scanCRes.status === 400 && scanBRes.status === 400) {
        console.log('🎉 ALL INTEGRATED ANNOUNCEMENT & ATTENDANCE TESTS PASSED 100%!');
      } else {
        throw new Error('Test assertions failed!');
      }
      console.log('=====================================================================');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ TEST ERROR:', err.message);
    process.exit(1);
  }
}

runTest();
