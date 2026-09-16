module.exports = (sequelize, DataTypes) => {
  const DistributionEvent = sequelize.define(
    'DistributionEvent',
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      program_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'benefit_programs',
          key: 'id',
        },
      },
      barangay_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'barangays',
          key: 'id',
        },
      },
      distribution_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      venue: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      budget: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      amount_per_beneficiary: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      assigned_staff_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'ongoing', 'completed', 'archived'),
        allowNull: false,
        defaultValue: 'draft',
      },
      total_beneficiaries: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_released: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_amount_released: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      target_category: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Optional category filter for this distribution (e.g. 4Ps, Senior Citizen, PWD)',
      },
      published_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the distribution session was started by staff',
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // ── Non-Cash / In-Kind Program Support ──
      benefit_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Cash',
        comment: 'Cash, In-Kind, Service',
      },
      item_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Description of non-cash goods or service (e.g. Food Pack, Wheelchair, Seminar)',
      },
      item_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Quantity per beneficiary',
      },
      item_unit: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'pack',
        comment: 'Unit of measure: pack, kit, unit, session, sack',
      },
      agency: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'DSWD',
        comment: 'Agency scope: DSWD or MSWDO',
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        comment: 'User ID of the creator',
      },
    },
    {
      tableName: 'distribution_events',
      underscored: true,
    }
  );

  return DistributionEvent;
};
