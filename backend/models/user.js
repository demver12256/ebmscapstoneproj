
const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
          isEmailOrEmpty(value) {
            if (value && value.trim() !== '') {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                throw new Error('Must be a valid email address');
              }
            }
          },
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      contact_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      barangay_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('admin', 'mswdo_admin', 'staff', 'barangay', 'beneficiary'),
        allowNull: false,
        defaultValue: 'beneficiary',
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      inactive_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      underscored: true,
      hooks: {
        beforeValidate: (user) => {
          if (user.email === '' || (typeof user.email === 'string' && user.email.trim() === '')) {
            user.email = null;
          } else if (typeof user.email === 'string') {
            user.email = user.email.trim().toLowerCase();
          }
          if (user.username && typeof user.username === 'string') {
            user.username = user.username.trim();
          }
        },
        beforeCreate: async (user) => {
          if (user.password) {
            user.password = await bcrypt.hash(user.password, 10);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('password')) {
            user.password = await bcrypt.hash(user.password, 10);
          }
        },
      },
    }
  );

  User.prototype.comparePassword = async function (candidate) {
    return bcrypt.compare(candidate, this.password);
  };

  return User;
};
