const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

// Disable strict mode so legacy zero-dates don't block schema migrations
sequelize.addHook('afterConnect', (connection) => {
  connection.query("SET sql_mode = 'NO_ENGINE_SUBSTITUTION'", () => { });
});

const User = require('./models/user')(sequelize, DataTypes);
const Barangay = require('./models/barangay')(sequelize, DataTypes);
const Beneficiary = require('./models/beneficiary')(sequelize, DataTypes);
const BeneficiaryDocument = require('./models/beneficiaryDocument')(sequelize, DataTypes);
const BenefitProgram = require('./models/benefitProgram')(sequelize, DataTypes);
const Enrollment = require('./models/enrollment')(sequelize, DataTypes);
const DistributionEvent = require('./models/distributionEvent')(sequelize, DataTypes);
const DistributionTransaction = require('./models/distributionTransaction')(sequelize, DataTypes);
const Attendance = require('./models/attendance')(sequelize, DataTypes);
const SMSNotification = require('./models/smsNotification')(sequelize, DataTypes);
const AuditLog = require('./models/auditLog')(sequelize, DataTypes);
const Message = require('./models/message')(sequelize, DataTypes);
const Notification = require('./models/notification')(sequelize, DataTypes);
const Announcement = require('./models/announcement')(sequelize, DataTypes);
const AnnouncementRecipient = require('./models/announcementRecipient')(sequelize, DataTypes);
const Otp = require('./models/otp')(sequelize, DataTypes);
const AssistanceRequest = require('./models/assistanceRequest')(sequelize, DataTypes);
const MedicalAssistanceApplication = require('./models/medicalAssistanceApplication')(sequelize, DataTypes);
const MedicalAssistanceDocument = require('./models/medicalAssistanceDocument')(sequelize, DataTypes);
const Intervention = require('./models/intervention')(sequelize, DataTypes);

// ── User ↔ Barangay ──
User.belongsTo(Barangay, { foreignKey: 'barangay_id' });
Barangay.hasMany(User, { foreignKey: 'barangay_id' });

// ── Beneficiary ↔ User / Barangay ──
Beneficiary.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(Beneficiary, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Beneficiary.belongsTo(Barangay, { foreignKey: 'barangay_id' });
Barangay.hasMany(Beneficiary, { foreignKey: 'barangay_id' });
Beneficiary.hasMany(BeneficiaryDocument, { foreignKey: 'beneficiary_id', as: 'Documents', onDelete: 'CASCADE' });
BeneficiaryDocument.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Beneficiary.belongsTo(User, { as: 'ApprovingStaff', foreignKey: 'approving_staff_id' });

// ── BenefitProgram ↔ Barangay ──
BenefitProgram.belongsTo(Barangay, { foreignKey: 'barangay_id' });
Barangay.hasMany(BenefitProgram, { foreignKey: 'barangay_id' });

// ── Enrollment ↔ Beneficiary / Program ──
Enrollment.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Beneficiary.hasMany(Enrollment, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Enrollment.belongsTo(BenefitProgram, { foreignKey: 'program_id', onDelete: 'CASCADE' });
BenefitProgram.hasMany(Enrollment, { foreignKey: 'program_id', onDelete: 'CASCADE' });

// ── DistributionEvent ↔ Program / Barangay / User (Staff) ──
DistributionEvent.belongsTo(BenefitProgram, { foreignKey: 'program_id', as: 'Program' });
BenefitProgram.hasMany(DistributionEvent, { foreignKey: 'program_id', as: 'DistributionEvents' });
DistributionEvent.belongsTo(Barangay, { foreignKey: 'barangay_id' });
Barangay.hasMany(DistributionEvent, { foreignKey: 'barangay_id' });
DistributionEvent.belongsTo(User, { foreignKey: 'assigned_staff_id', as: 'AssignedStaff' });
DistributionEvent.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });

// ── DistributionTransaction ↔ DistributionEvent / Beneficiary / User (Staff) ──
DistributionTransaction.belongsTo(DistributionEvent, { foreignKey: 'distribution_event_id', as: 'Event', onDelete: 'CASCADE' });
DistributionEvent.hasMany(DistributionTransaction, { foreignKey: 'distribution_event_id', as: 'Transactions', onDelete: 'CASCADE' });
DistributionTransaction.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Beneficiary.hasMany(DistributionTransaction, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
DistributionTransaction.belongsTo(User, { foreignKey: 'released_by_staff_id', as: 'ReleasedByStaff' });

// ── Notification ↔ User ──
Notification.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(Notification, { foreignKey: 'user_id', onDelete: 'CASCADE' });

// ── Attendance ↔ Beneficiary ──
Attendance.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Beneficiary.hasMany(Attendance, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });

// ── SMS ↔ Beneficiary ──
SMSNotification.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Beneficiary.hasMany(SMSNotification, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
SMSNotification.belongsTo(Announcement, { foreignKey: 'announcement_id', onDelete: 'SET NULL' });
Announcement.hasMany(SMSNotification, { foreignKey: 'announcement_id', as: 'SMSNotifications', onDelete: 'SET NULL' });

// ── AuditLog ↔ User ──
AuditLog.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(AuditLog, { foreignKey: 'user_id', onDelete: 'CASCADE' });

// ── Message ↔ User ──
Message.belongsTo(User, { as: 'Sender', foreignKey: 'sender_id', onDelete: 'CASCADE' });
Message.belongsTo(User, { as: 'Receiver', foreignKey: 'receiver_id', onDelete: 'CASCADE' });
User.hasMany(Message, { as: 'SentMessages', foreignKey: 'sender_id', onDelete: 'CASCADE' });
User.hasMany(Message, { as: 'ReceivedMessages', foreignKey: 'receiver_id', onDelete: 'CASCADE' });

// ── Announcement Associations ──
Announcement.belongsTo(User, { as: 'CreatedBy', foreignKey: 'created_by_user_id' });
Announcement.belongsTo(User, { as: 'AssignedStaff', foreignKey: 'assigned_staff_id' });
User.hasMany(Announcement, { as: 'AssignedAnnouncements', foreignKey: 'assigned_staff_id' });
User.hasMany(Announcement, { foreignKey: 'created_by_user_id' });

Announcement.hasMany(AnnouncementRecipient, { foreignKey: 'announcement_id', as: 'Recipients', onDelete: 'CASCADE' });
AnnouncementRecipient.belongsTo(Announcement, { foreignKey: 'announcement_id', onDelete: 'CASCADE' });

AnnouncementRecipient.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', as: 'Beneficiary', onDelete: 'CASCADE' });
Beneficiary.hasMany(AnnouncementRecipient, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });

AnnouncementRecipient.belongsTo(User, { foreignKey: 'user_id', as: 'User', onDelete: 'CASCADE' });
User.hasMany(AnnouncementRecipient, { foreignKey: 'user_id', onDelete: 'CASCADE' });

AnnouncementRecipient.belongsTo(User, { as: 'ScannedByStaff', foreignKey: 'scanned_by_staff_id' });

Attendance.belongsTo(Announcement, { foreignKey: 'announcement_id', as: 'Announcement', onDelete: 'CASCADE' });
Announcement.hasMany(Attendance, { foreignKey: 'announcement_id', as: 'Attendances', onDelete: 'CASCADE' });
Attendance.belongsTo(User, { as: 'ScannedByStaff', foreignKey: 'scanned_by_staff_id' });

// ── AssistanceRequest ↔ Beneficiary / User / Barangay ──
AssistanceRequest.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Beneficiary.hasMany(AssistanceRequest, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
AssistanceRequest.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(AssistanceRequest, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AssistanceRequest.belongsTo(Barangay, { foreignKey: 'barangay_id' });
Barangay.hasMany(AssistanceRequest, { foreignKey: 'barangay_id' });
AssistanceRequest.belongsTo(User, { as: 'Reviewer', foreignKey: 'reviewed_by' });

// ── MedicalAssistanceApplication Associations ──
MedicalAssistanceApplication.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Beneficiary.hasMany(MedicalAssistanceApplication, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
MedicalAssistanceApplication.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(MedicalAssistanceApplication, { foreignKey: 'user_id', onDelete: 'CASCADE' });
MedicalAssistanceApplication.belongsTo(Barangay, { foreignKey: 'barangay_id' });
Barangay.hasMany(MedicalAssistanceApplication, { foreignKey: 'barangay_id' });
MedicalAssistanceApplication.belongsTo(User, { as: 'BarangayVerifier', foreignKey: 'barangay_verified_by' });
MedicalAssistanceApplication.belongsTo(User, { as: 'Reviewer', foreignKey: 'reviewed_by' });
MedicalAssistanceApplication.belongsTo(User, { as: 'ReleasedBy', foreignKey: 'released_by' });

MedicalAssistanceApplication.hasMany(MedicalAssistanceDocument, { foreignKey: 'application_id', as: 'Documents', onDelete: 'CASCADE' });
MedicalAssistanceDocument.belongsTo(MedicalAssistanceApplication, { foreignKey: 'application_id', onDelete: 'CASCADE' });

// ── Intervention Associations ──
Intervention.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id', onDelete: 'CASCADE' });
Beneficiary.hasMany(Intervention, { foreignKey: 'beneficiary_id', as: 'Interventions', onDelete: 'CASCADE' });
Intervention.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(Intervention, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Intervention.belongsTo(Barangay, { foreignKey: 'barangay_id' });
Barangay.hasMany(Intervention, { foreignKey: 'barangay_id' });
Intervention.belongsTo(User, { as: 'Verifier', foreignKey: 'verified_by' });

const connectDatabase = async () => {
  await sequelize.authenticate();

  const ensureColumn = async (table, column, definition) => {
    try {
      const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
      if (cols.length === 0) {
        await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`[DB Migration] Added column ${column} to ${table}`);
      }
    } catch (err) {
      console.warn(`[DB Migration] ensureColumn ${table}.${column} skipped:`, err.message);
    }
  };

  try {
    // Ensure email column allows NULL for users without email
    await sequelize.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL');
  } catch (err) {
    // Ignore error if table does not exist yet or already nullable
  }

  // Ensure tables exist non-destructively
  try {
    await AssistanceRequest.sync();
    await MedicalAssistanceApplication.sync();
    await MedicalAssistanceDocument.sync();
    await Intervention.sync();
  } catch (err) {
    console.warn('[DB Migration] Model.sync skipped:', err.message);
  }

  // Ensure recent columns exist on assistance_requests
  await ensureColumn('assistance_requests', 'agency', "ENUM('DSWD', 'MSWDO') NOT NULL DEFAULT 'DSWD'");
  await ensureColumn('assistance_requests', 'attachment_url', 'TEXT NULL');
  await ensureColumn('assistance_requests', 'claimed_at', 'DATETIME NULL');
  await ensureColumn('assistance_requests', 'claimed_by', 'INT NULL');
  await ensureColumn('assistance_requests', 'rfid_scanned', 'VARCHAR(255) NULL');
  await ensureColumn('assistance_requests', 'valid_id_verified', 'TINYINT(1) DEFAULT 0');
  await ensureColumn('assistance_requests', 'approved_amount', 'DECIMAL(12, 2) NULL');

  // Ensure recent columns exist on announcements
  await ensureColumn('announcements', 'target_sitios', 'JSON NULL');
  await ensureColumn('announcements', 'assigned_staff_id', 'INT NULL');
  await ensureColumn('announcements', 'notify_senior', 'TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn('announcements', 'notify_pwd', 'TINYINT(1) NOT NULL DEFAULT 0');

  // Ensure recent columns exist on distribution_events
  await ensureColumn('distribution_events', 'target_sitio', 'VARCHAR(255) NULL');
  await ensureColumn('distribution_events', 'target_category', 'VARCHAR(100) NULL');
  await ensureColumn('distribution_events', 'benefit_type', 'VARCHAR(100) NULL');
  await ensureColumn('distribution_events', 'package_items', 'TEXT NULL');

  try {
    // Allow program_id to be NULL for direct / MSWDO distributions
    await sequelize.query('ALTER TABLE distribution_events MODIFY COLUMN program_id INT NULL');
  } catch (err) {
    console.warn('[DB Migration] distribution_events.program_id NULL skipped:', err.message);
  }

  try {
    // Allow barangay_id to be NULL for municipality-wide MSWDO/Senior/PWD distributions
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.query('ALTER TABLE distribution_events MODIFY COLUMN barangay_id INT NULL');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[DB Migration] distribution_events.barangay_id successfully set to NULL');
  } catch (err) {
    console.warn('[DB Migration] distribution_events.barangay_id NULL skipped:', err.message);
  }

  try {
    // Ensure users.role ENUM includes mswdo_staff and all sector admin roles
    await sequelize.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('admin','mswdo_admin','senior_citizen_admin','pwd_admin','staff','mswdo_staff','senior_citizen_staff','pwd_staff','barangay','beneficiary') NOT NULL DEFAULT 'beneficiary'"
    );
  } catch (err) {
    console.warn('[DB Migration] users.role ENUM migration skipped:', err.message);
  }

  // Ensure recent columns exist on beneficiaries
  await ensureColumn('beneficiaries', 'qr_token', 'VARCHAR(64) NULL');
  await ensureColumn('beneficiaries', 'qr_generated_at', 'DATETIME NULL');
  await ensureColumn('beneficiaries', 'rfid_assigned_at', 'DATETIME NULL');
  await ensureColumn('beneficiaries', 'payout_preference', "VARCHAR(50) DEFAULT 'cash_otc'");
  await ensureColumn('beneficiaries', 'payout_provider', 'VARCHAR(100) NULL');
  await ensureColumn('beneficiaries', 'payout_account_number', 'VARCHAR(100) NULL');
  await ensureColumn('beneficiaries', 'payout_account_name', 'VARCHAR(150) NULL');
  await ensureColumn('beneficiaries', 'account_verification_status', "VARCHAR(50) NOT NULL DEFAULT 'unverified'");
  await ensureColumn('beneficiaries', 'account_verified_at', 'DATETIME NULL');
  await ensureColumn('beneficiaries', 'extra_payout_accounts', 'TEXT NULL');

  try {
    // Ensure announcements.status ENUM supports staff approval workflow (pending_approval, rejected)
    await sequelize.query(
      "ALTER TABLE announcements MODIFY COLUMN status ENUM('draft', 'pending_approval', 'scheduled', 'published', 'completed', 'rejected', 'archived') NOT NULL DEFAULT 'published'"
    );
  } catch (err) {
    console.warn('announcements.status ENUM migration skipped:', err.message);
  }
  try {
    // Ensure notifications.type ENUM supports announcement notifications
    await sequelize.query(
      "ALTER TABLE notifications MODIFY COLUMN type ENUM('distribution', 'program', 'system', 'announcement', 'announcement_absence') NOT NULL DEFAULT 'system'"
    );
  } catch (err) {
    console.warn('notifications.type ENUM migration skipped:', err.message);
  }
  // alter:{drop:false} adds new columns/tables but skips re-creating existing indexes,
  // preventing the duplicate _2, _3... index buildup that hits MySQL's 64-key limit.
  if (process.env.NODE_ENV === 'production') {
  // Do NOT sync. Run migrations separately in CI/CD.
  } else {
    await sequelize.sync({ alter: { drop: false } });
  }
  
  console.log('MySQL database connection established successfully.');

  // Issue QR passes to approved beneficiaries that don't have one yet
  try {
    const missing = await Beneficiary.findAll({
      where: { status: 'Approved', qr_token: null },
      attributes: ['id'],
    });
    for (const b of missing) {
      await Beneficiary.update(
        { qr_token: Beneficiary.generateQrToken(), qr_generated_at: new Date() },
        { where: { id: b.id }, hooks: false }
      );
    }
    if (missing.length) console.log(`Issued QR passes to ${missing.length} approved beneficiaries.`);
  } catch (err) {
    console.warn('QR pass backfill skipped:', err.message);
  }
};

module.exports = {
  sequelize,
  connectDatabase,
  User,
  Barangay,
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
};
