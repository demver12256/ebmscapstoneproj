module.exports = (sequelize, DataTypes) => {
  const AssistanceRequest = sequelize.define(
    'AssistanceRequest',
    {
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      barangay_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      agency: {
        type: DataTypes.ENUM('DSWD', 'MSWDO'),
        allowNull: false,
        defaultValue: 'DSWD',
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      priority: {
        type: DataTypes.ENUM('Low', 'Normal', 'Urgent'),
        allowNull: false,
        defaultValue: 'Normal',
      },
      admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attachment_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      claimed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      claimed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      rfid_scanned: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      valid_id_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: 'assistance_requests',
      underscored: true,
    }
  );

  return AssistanceRequest;
};
