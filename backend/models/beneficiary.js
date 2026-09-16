module.exports = (sequelize, DataTypes) => {
  const Beneficiary = sequelize.define(
    'Beneficiary',
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      middle_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sex: {
        type: DataTypes.ENUM('Male', 'Female', 'Other'),
        allowNull: false,
      },
      birthdate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      civil_status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      barangay_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ip_classification: {
        type: DataTypes.ENUM('IP', 'Non-IP'),
        allowNull: false,
        defaultValue: 'Non-IP',
      },
      RFID_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      contact_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile_picture: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('Pending Submission', 'Pending Review', 'Under Review', 'Approved', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending Submission',
      },
      beneficiary_id_code: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      household_id_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      approval_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      approving_staff_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      inactivation_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      missing_documents: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      national_id_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      psa_birth_cert_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      sitio: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // ── Payout & Disbursement Details ──
      payout_preference: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'cash_otc',
        comment: 'Preferred payout method: cash_otc (Physical Cash / RFID) or digital (E-Wallet / Bank)',
      },
      payout_provider: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Financial provider: GCash, Maya, Landbank, Other',
      },
      payout_account_number: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Mobile number (for GCash/Maya) or ATM account number (for Landbank)',
      },
      payout_account_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Registered account holder name for name-matching verification',
      },
      account_verification_status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'unverified',
        comment: 'Account verification status: unverified, verified, rejected',
      },
      account_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when payout account was verified',
      },
      extra_payout_accounts: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON array of secondary payout accounts [{provider, account_number, account_name, verification_status, added_at}]',
        get() {
          const raw = this.getDataValue('extra_payout_accounts');
          if (!raw) return [];
          try { return JSON.parse(raw); } catch { return []; }
        },
        set(val) {
          this.setDataValue('extra_payout_accounts', val ? JSON.stringify(val) : null);
        }
      },
    },
    {
      tableName: 'beneficiaries',
      underscored: true,
    }
  );

  return Beneficiary;
};
