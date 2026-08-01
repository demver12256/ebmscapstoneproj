module.exports = (sequelize, DataTypes) => {
  const BeneficiaryDocument = sequelize.define(
    'BeneficiaryDocument',
    {
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      document_type: {
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
    },
    {
      tableName: 'beneficiary_documents',
      underscored: true,
    }
  );

  return BeneficiaryDocument;
};
