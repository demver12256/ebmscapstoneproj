module.exports = (sequelize, DataTypes) => {
  const MedicalAssistanceDocument = sequelize.define(
    'MedicalAssistanceDocument',
    {
      application_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      document_code: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Code identifying the requirement: valid_id, medical_certificate, prescription, price_quotation, etc.',
      },
      document_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      file_path: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      file_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      file_size: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      mime_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Needs Resubmission'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'medical_assistance_documents',
      underscored: true,
    }
  );

  return MedicalAssistanceDocument;
};
