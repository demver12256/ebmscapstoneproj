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
      profile_photo: {
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
    },
    {
      tableName: 'beneficiaries',
      underscored: true,
    }
  );

  return Beneficiary;
};
