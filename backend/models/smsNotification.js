module.exports = (sequelize, DataTypes) => {
  const SMSNotification = sequelize.define(
    'SMSNotification',
    {
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('queued', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'queued',
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'sms_notifications',
      underscored: true,
    }
  );

  return SMSNotification;
};
