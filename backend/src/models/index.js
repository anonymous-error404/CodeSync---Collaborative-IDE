import sequelize from '../config/database.js';
import User from './User.js';

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

export { syncDatabase };
export default db;
export { User };
