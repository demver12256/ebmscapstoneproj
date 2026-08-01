module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Drop existing foreign keys
      await queryInterface.removeConstraint('enrollments', 'enrollments_ibfk_1');
      await queryInterface.removeConstraint('enrollments', 'enrollments_ibfk_2');
      await queryInterface.removeConstraint('distributions', 'distributions_ibfk_1');
      
      console.log('Dropped old foreign keys');

      // Add new foreign keys with ON DELETE CASCADE
      await queryInterface.addConstraint('enrollments', {
        fields: ['beneficiary_id'],
        type: 'foreign key',
        name: 'enrollments_ibfk_1',
        references: {
          table: 'beneficiaries',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      await queryInterface.addConstraint('enrollments', {
        fields: ['program_id'],
        type: 'foreign key',
        name: 'enrollments_ibfk_2',
        references: {
          table: 'benefit_programs',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      await queryInterface.addConstraint('distributions', {
        fields: ['enrollment_id'],
        type: 'foreign key',
        name: 'distributions_ibfk_1',
        references: {
          table: 'enrollments',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      console.log('Added new foreign keys with CASCADE delete');
    } catch (error) {
      console.log('Migration error:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Rollback - drop the new foreign keys
      await queryInterface.removeConstraint('enrollments', 'enrollments_ibfk_1');
      await queryInterface.removeConstraint('enrollments', 'enrollments_ibfk_2');
      await queryInterface.removeConstraint('distributions', 'distributions_ibfk_1');
      
      console.log('Migration rolled back');
    } catch (error) {
      console.log('Migration rollback error:', error.message);
      throw error;
    }
  }
};
