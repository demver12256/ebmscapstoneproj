module.exports = (sequelize, DataTypes) => {
  const Announcement = sequelize.define(
    'Announcement',
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      event_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      event_time: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      end_time: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      venue: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      priority: {
        type: DataTypes.ENUM('Low', 'Medium', 'High', 'Urgent'),
        allowNull: false,
        defaultValue: 'Medium',
      },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'published', 'completed', 'archived'),
        allowNull: false,
        defaultValue: 'published',
      },
      publish_date: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      expiration_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      target_programs: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of benefit program IDs e.g. [1, 2]',
      },
      target_barangays: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of barangay IDs e.g. [3, 5]',
      },
      created_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      recipient_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      view_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'announcements',
      underscored: true,
    }
  );

  return Announcement;
};
