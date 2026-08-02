module.exports = (sequelize, DataTypes) => {
  const AnnouncementRecipient = sequelize.define(
    'AnnouncementRecipient',
    {
      announcement_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'announcements',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'beneficiaries',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      attendance_status: {
        type: DataTypes.ENUM('Pending', 'Present', 'Absent'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      scanned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      scanned_by_staff_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      notification_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sms_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'announcement_recipients',
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['announcement_id', 'beneficiary_id'],
        },
      ],
    }
  );

  return AnnouncementRecipient;
};
