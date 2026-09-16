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
      retro_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Retroactive payment amount added on top of regular amount',
      },
      retro_periods: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of missed periods being compensated',
      },
      retro_details: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON breakdown of retro periods covered',
      },
      // ── Digital Payout / Disbursement Tracking ──
      disbursement_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'cash_otc',
        comment: 'Disbursement method: cash_otc (physical/RFID) or digital (e-wallet/bank)',
      },
      payout_provider: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Financial provider used: GCash, Maya, Landbank, etc.',
      },
      payout_reference_number: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Generated payment reference number (e.g. GCASH-REF-2026-09281)',
      },
      beneficiary_acknowledged_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when beneficiary confirmed receipt of digital payout in app',
      },
      beneficiary_acknowledgment_notes: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Optional note or feedback from beneficiary upon confirming receipt',
      },
      // ── Non-Cash / In-Kind Item Tracking ──
      item_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Item name or service title received by beneficiary',
      },
      item_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Quantity of items or sessions received',
      },
    },
    {
      tableName: 'distribution_transactions',
      underscored: true,
    }
  );

  return DistributionTransaction;
};
