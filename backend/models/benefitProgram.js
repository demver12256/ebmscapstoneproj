module.exports = (sequelize, DataTypes) => {
  const BenefitProgram = sequelize.define(
    'BenefitProgram',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      eligibility_category: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Target beneficiary category: 4Ps, Senior Citizen, PWD, AICS, etc.',
      },
      benefit_type: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'Cash',
        comment: 'Cash, In-Kind, Service, etc.',
      },
      eligibility_requirements: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON or text description of eligibility requirements',
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'archived', 'completed', 'draft'),
        allowNull: false,
        defaultValue: 'active',
      },
      total_budget: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
      },
      allocated_budget: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      barangay_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'barangays',
          key: 'id',
        },
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
      tableName: 'benefit_programs',
      underscored: true,
    }
  );

  return BenefitProgram;
};
