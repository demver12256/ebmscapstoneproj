module.exports = (sequelize, DataTypes) => {
  const Intervention = sequelize.define(
    'Intervention',
    {
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Reference to beneficiary who received assistance',
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'User account of beneficiary',
      },
      barangay_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Barangay of beneficiary',
      },
      agency_name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Name of agency/organization that provided assistance (PhilHealth, PCSO, LGU, etc.)',
      },
      assistance_type: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Type of assistance received (Medical, Financial, Educational, etc.)',
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Amount of assistance received',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional details about the assistance',
      },
      date_received: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Date when assistance was received',
      },
      proof_document_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'URL/path to uploaded proof documents (receipts, certificates, etc.)',
      },
      status: {
        type: DataTypes.ENUM('Pending', 'Verified', 'Rejected'),
        allowNull: false,
        defaultValue: 'Pending',
        comment: 'Verification status by staff',
      },
      verified_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Staff/Admin user ID who verified this intervention',
      },
      verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when verification was done',
      },
      staff_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notes from staff during verification',
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason if intervention was rejected',
      },
    },
    {
      tableName: 'interventions',
      underscored: true,
      indexes: [
        {
          fields: ['beneficiary_id'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['date_received'],
        },
      ],
    }
  );

  return Intervention;
};
