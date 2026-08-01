const { sequelize } = require('./db');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');
    
    // Drop all tables and recreate them fresh
    await sequelize.sync({ force: true });
    console.log('Database tables successfully dropped and recreated fresh!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to reset database:', error);
    process.exit(1);
  }
})();
