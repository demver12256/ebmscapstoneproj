module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define(
    'Attendance',
    {
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      RFID_number: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      event_name: {
        type: DataTypes.STRING,
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
      scanned_by_staff_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      attendance_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      time_in: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Present',
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'attendances',
      underscored: true,
    }
  );

  return Attendance;
};
