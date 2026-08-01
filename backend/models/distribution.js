module.exports = (sequelize, DataTypes) => {
  const Distribution = sequelize.define(
    'Distribution',
    {
      enrollment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      date_distributed: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      distribution_status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      tableName: 'distributions',
      underscored: true,
    }
  );

  return Distribution;
};
