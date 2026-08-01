module.exports = (sequelize, DataTypes) => {
  const DistributionTransaction = sequelize.define(
    'DistributionTransaction',
    {
      transaction_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      distribution_event_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'distribution_events',
          key: 'id',
        },
      },
      beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'beneficiaries',
          key: 'id',
        },
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('pending', 'released', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      released_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      released_by_staff_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      signature_data: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Base64 encoded signature image',
      },
      photo_proof: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'File path for photo proof of receipt',
      },
      verification_method: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'rfid, qr, id, manual',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'distribution_transactions',
      underscored: true,
    }
  );

  return DistributionTransaction;
};
