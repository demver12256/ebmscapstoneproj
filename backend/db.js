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

const connectDatabase = async () => {
  await sequelize.authenticate();
  // alter:{drop:false} adds new columns/tables but skips re-creating existing indexes,
  // preventing the duplicate _2, _3... index buildup that hits MySQL's 64-key limit.
  await sequelize.sync({ alter: { drop: false } });
  console.log('MySQL database connection established successfully.');
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
};
