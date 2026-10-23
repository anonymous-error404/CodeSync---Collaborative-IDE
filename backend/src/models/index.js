import sequelize from '../config/database.js';
import User from './User.js';
import WorkspaceMember from './WorkspaceMember.js';
import WorkspaceInvite from './WorkspaceInvite.js';
import Whiteboard from './Whiteboard.js';
import TeachingSession from './TeachingSession.js';

WorkspaceMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(WorkspaceMember, { foreignKey: 'userId' });

WorkspaceInvite.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
TeachingSession.belongsTo(User, { as: 'teacher', foreignKey: 'teacherUserId' });

const db = {
  sequelize,
  User,
  WorkspaceMember,
  WorkspaceInvite,
  Whiteboard,
  TeachingSession,
};

/**
 * Initialize database and sync models
 * @param {object} options
 */
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.authenticate();
    console.log('[Database]: SQLite connection established successfully.');

    // Cleanup any lingering backup tables from previous interrupted alters
    await sequelize.query('DROP TABLE IF EXISTS `users_backup`;');
    await sequelize.query('DROP TABLE IF EXISTS `workspace_members_backup`;');
    await sequelize.query('DROP TABLE IF EXISTS `teaching_sessions_backup`;');

    await sequelize.sync(options);
    console.log('[Database]: Models synchronized with SQLite database.');
  } catch (error) {
    console.error('[Database Error]: Failed to connect or sync database:', error);
    throw error;
  }
};

export { syncDatabase };
export default db;
export { User, WorkspaceMember, WorkspaceInvite, Whiteboard, TeachingSession };
