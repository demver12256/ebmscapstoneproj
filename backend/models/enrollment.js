module.exports = (sequelize, DataTypes) => {
  const Enrollment = sequelize.define(
    'Enrollment',
    {
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      program_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      enrollment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.ENUM('pending', 'active', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      tableName: 'enrollments',
      underscored: true,
    }
  );

  return Enrollment;
};
