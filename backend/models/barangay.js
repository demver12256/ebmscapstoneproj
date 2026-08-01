module.exports = (sequelize, DataTypes) => {
  const Barangay = sequelize.define(
    'Barangay',
    {
      barangay_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      barangay_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      captain_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      contact_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'barangays',
      underscored: true,
    }
  );

  return Barangay;
};
