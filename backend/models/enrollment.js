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
      eligibility_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Date when beneficiary became eligible for this program. Defaults to enrollment_date if not set.',
      },
    },
    {
      tableName: 'enrollments',
      underscored: true,
    }
  );

  return Enrollment;
};
