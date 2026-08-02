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
} = require('./db');

const announcementsRouter = require('./routes/announcements');

// Set up in-memory Express App for testing
const app = express();
app.use(express.json());
app.use('/api/announcements', announcementsRouter);

async function runTest() {
  console.log('====================================================');
  console.log('🚀 TESTING ANNOUNCEMENT MANAGEMENT MODULE DIRECTLY');
  console.log('====================================================\n');

  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: { drop: false } });

    // 1. Ensure Admin User exists & generate token
    let admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) {
      admin = await User.create({
        first_name: 'System',
        last_name: 'Administrator',
        email: 'admin@ebms.local',
        password: 'Admin@123',
        role: 'admin',
        status: 'active',
      });
    }

    const adminToken = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'your-secret-key-for-ebms-jwt-token-2026');
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };
    console.log('✅ Generated JWT Token for Admin:', admin.email);

    // 2. Setup Test Barangays (Anilao, Poblacion)
    const [brgyAnilao] = await Barangay.findOrCreate({
      where: { barangay_name: 'Anilao' },
      defaults: { barangay_name: 'Anilao' },
    });

    const [brgyPoblacion] = await Barangay.findOrCreate({
      where: { barangay_name: 'Poblacion' },
      defaults: { barangay_name: 'Poblacion' },
    });

    console.log('✅ Barangays ready:', {
      Anilao: brgyAnilao.id,
      Poblacion: brgyPoblacion.id,
    });

    // 3. Setup Test Benefit Programs (4Ps, Senior Citizen)
    const [prog4Ps] = await BenefitProgram.findOrCreate({
      where: { name: '4Ps Program' },
      defaults: {
        name: '4Ps Program',
        code: '4Ps',
        eligibility_category: '4Ps',
        status: 'active',
      },
    });

    const [progSenior] = await BenefitProgram.findOrCreate({
      where: { name: 'Senior Citizen Cash Assistance' },
      defaults: {
        name: 'Senior Citizen Cash Assistance',
        code: 'SENIOR',
        eligibility_category: 'Senior Citizen',
        status: 'active',
      },
    });

    console.log('✅ Programs ready:', {
      '4Ps': prog4Ps.id,
      Senior: progSenior.id,
    });

    // Helper to create test beneficiary + user + enrollment
    async function createTestBeneficiary(email, firstName, lastName, barangayId, programId) {
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
          birthdate: '1992-05-15',
          barangay_id: barangayId,
          status: 'Approved',
          contact_number: '09171234567',
        });
      } else {
        await ben.update({ barangay_id: barangayId, status: 'Approved' });
      }

      if (programId) {
        await Enrollment.findOrCreate({
          where: { beneficiary_id: ben.id, program_id: programId },
          defaults: {
            beneficiary_id: ben.id,
            program_id: programId,
            status: 'active',
          },
        });
      }

      return { user, ben };
    }

    // Create 4 test subjects matching the scenario in the user prompt:
    // A: 4Ps + Anilao (Targeted -> MUST receive)
    const benA = await createTestBeneficiary('ben_anilao_4ps@ebms.local', 'Maria', 'Santos', brgyAnilao.id, prog4Ps.id);
    // B: 4Ps + Poblacion (Wrong barangay -> MUST NOT receive)
    const benB = await createTestBeneficiary('ben_poblacion_4ps@ebms.local', 'Juan', 'Dela Cruz', brgyPoblacion.id, prog4Ps.id);
    // C: Senior Citizen + Anilao (Wrong program -> MUST NOT receive)
    const benC = await createTestBeneficiary('ben_anilao_senior@ebms.local', 'Pedro', 'Reyes', brgyAnilao.id, progSenior.id);
    // D: Senior Citizen + Poblacion (Wrong program & barangay -> MUST NOT receive)
    const benD = await createTestBeneficiary('ben_poblacion_senior@ebms.local', 'Ana', 'Ramos', brgyPoblacion.id, progSenior.id);

    console.log('✅ Created 4 Test Beneficiaries for strict targeting evaluation.');

    // Start ephemeral server
    const server = app.listen(5099, async () => {
      const BASE = 'http://127.0.0.1:5099/api/announcements';

      // 4. Test Target Preview Count Endpoint
      const previewParams = new URLSearchParams({
        target_programs: JSON.stringify([prog4Ps.id]),
        target_barangays: JSON.stringify([brgyAnilao.id]),
      });
      const previewRes = await fetch(`${BASE}/preview-count?${previewParams}`, {
        headers: adminHeaders,
      });
      const previewData = await previewRes.json();
      console.log('📊 Target Preview Count for (4Ps + Anilao):', previewData.count);

      // 5. Admin creates and publishes Announcement for (4Ps + Anilao)
      // Scenario from prompt:
      // Title: 4Ps Family Development Session
      // Program: 4Ps
      // Target Barangay: Anilao
      // Date: August 15, 2026
      // Time: 9:00 AM
      // Venue: Barangay Anilao Covered Court
      // Message: "All registered 4Ps beneficiaries of Barangay Anilao are required to attend the Family Development Session. Attendance is mandatory."

      const announcementPayload = {
        title: '4Ps Family Development Session',
        message: 'All registered 4Ps beneficiaries of Barangay Anilao are required to attend the Family Development Session. Attendance is mandatory.',
        event_date: '2026-08-15',
        event_time: '9:00 AM',
        venue: 'Barangay Anilao Covered Court',
        priority: 'Urgent',
        status: 'published',
        target_programs: [prog4Ps.id],
        target_barangays: [brgyAnilao.id],
      };

      const createRes = await fetch(BASE, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(announcementPayload),
      });

      const createData = await createRes.json();
      const createdAnnouncement = createData.data;
      console.log('\n📣 Published Announcement ID:', createdAnnouncement.id);
      console.log('📊 Recipient Count returned:', createdAnnouncement.recipient_count);

      // 6. Verify Recipients in Database
      const recipients = await AnnouncementRecipient.findAll({
        where: { announcement_id: createdAnnouncement.id },
      });

      const recipientBenIds = recipients.map((r) => r.beneficiary_id);
      console.log('📋 Recipient Beneficiary IDs in DB:', recipientBenIds);

      // CRITICAL TARGETING VERIFICATIONS:
      const benA_Received = recipientBenIds.includes(benA.ben.id);
      const benB_Received = recipientBenIds.includes(benB.ben.id);
      const benC_Received = recipientBenIds.includes(benC.ben.id);
      const benD_Received = recipientBenIds.includes(benD.ben.id);

      console.log('\n--- TARGETING ACCURACY EVALUATION ---');
      console.log(`[VERIFIED] Beneficiary A (4Ps + Anilao): ${benA_Received ? '✅ RECEIVED (EXPECTED)' : '❌ FAILED'}`);
      console.log(`[VERIFIED] Beneficiary B (4Ps + Poblacion): ${!benB_Received ? '✅ BLOCKED (EXPECTED)' : '❌ FAILED'}`);
      console.log(`[VERIFIED] Beneficiary C (Senior + Anilao): ${!benC_Received ? '✅ BLOCKED (EXPECTED)' : '❌ FAILED'}`);
      console.log(`[VERIFIED] Beneficiary D (Senior + Poblacion): ${!benD_Received ? '✅ BLOCKED (EXPECTED)' : '❌ FAILED'}`);

      if (!benA_Received || benB_Received || benC_Received || benD_Received) {
        server.close();
        throw new Error('Targeting verification failed!');
      }

      // 7. Test Beneficiary Read & View Count Flow
      const benAToken = jwt.sign({ id: benA.user.id, role: benA.user.role }, process.env.JWT_SECRET || 'your-secret-key-for-ebms-jwt-token-2026');
      const benAHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${benAToken}`,
      };

      // Get beneficiary announcements list
      const benAnnRes = await fetch(BASE, { headers: benAHeaders });
      const benAnnData = await benAnnRes.json();
      console.log(`\n📱 Beneficiary A sees ${benAnnData.data?.length} announcement(s) on dashboard.`);

      // Beneficiary A marks announcement as read
      await fetch(`${BASE}/${createdAnnouncement.id}/read`, {
        method: 'PATCH',
        headers: benAHeaders,
      });
      console.log('✅ Beneficiary A marked announcement as READ.');

      // Verify view_count incremented
      const updatedAnnouncement = await Announcement.findByPk(createdAnnouncement.id);
      console.log(`📈 Announcement View Count updated to: ${updatedAnnouncement.view_count}`);

      // Verify Audit Log entry
      const auditLogs = await AuditLog.findAll({
        where: { module: 'Announcements' },
        order: [['timestamp', 'DESC']],
        limit: 5,
      });
      console.log('\n📜 Audit Log Entries count:', auditLogs.length);
      auditLogs.forEach((log) => {
        console.log(` - [${log.timestamp}] ${log.action}`);
      });

      server.close();
      console.log('\n====================================================');
      console.log('🎉 ALL ANNOUNCEMENT MODULE TESTS COMPLETED SUCCESSFULLY!');
      console.log('====================================================');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ TEST ERROR:', err.message);
    process.exit(1);
  }
}

runTest();
