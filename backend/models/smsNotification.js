module.exports = (sequelize, DataTypes) => {
  const SMSNotification = sequelize.define(
    'SMSNotification',
    {
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      announcement_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'announcements',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      notification_type: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      phone_number: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      provider_message_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
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
      failure_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'sms_notifications',
      underscored: true,
      hooks: {
        beforeCreate: (notification) => {
          notification.status = 'queued';
          notification.sent_at = null;
        },
        beforeBulkCreate: (notifications) => {
          notifications.forEach((notification) => {
            notification.status = 'queued';
            notification.sent_at = null;
          });
        },
      },
    }
  );

  return SMSNotification;
};
