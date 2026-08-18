const sequelize = require('../config/database');
const User = require('./User');

const db = {
  sequelize,
  User,
};

/**
 * Initialize database and sync models
 * @param {object} options
 */
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.authenticate();
    console.log('[Database]: SQLite connection established successfully.');
    
    await sequelize.sync(options);
    console.log('[Database]: Models synchronized with SQLite database.');
  } catch (error) {
    console.error('[Database Error]: Failed to connect or sync database:', error);
    throw error;
  }
};

module.exports = {
  ...db,
  syncDatabase,
};
