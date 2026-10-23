import sequelize from '../config/database.js';
import User from './User.js';
import WorkspaceMember from './WorkspaceMember.js';
import WorkspaceInvite from './WorkspaceInvite.js';
import Whiteboard from './Whiteboard.js';
import TeachingSession from './TeachingSession.js';
import ProjectTask from './ProjectTask.js';
import CodeReview from './CodeReview.js';

WorkspaceMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(WorkspaceMember, { foreignKey: 'userId' });

WorkspaceInvite.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
TeachingSession.belongsTo(User, { as: 'teacher', foreignKey: 'teacherUserId' });

// Professional workspace associations
ProjectTask.belongsTo(User, { as: 'assignee', foreignKey: 'assignedTo' });
ProjectTask.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
CodeReview.belongsTo(User, { as: 'author', foreignKey: 'authorId' });
CodeReview.belongsTo(User, { as: 'reviewer', foreignKey: 'reviewerId' });

const db = {
  sequelize,
  User,
  WorkspaceMember,
  WorkspaceInvite,
  Whiteboard,
  TeachingSession,
  ProjectTask,
  CodeReview,
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
    await sequelize.query('DROP TABLE IF EXISTS `project_tasks_backup`;');
    await sequelize.query('DROP TABLE IF EXISTS `code_reviews_backup`;');

    await sequelize.sync(options);
    console.log('[Database]: Models synchronized with SQLite database.');
  } catch (error) {
    console.error('[Database Error]: Failed to connect or sync database:', error);
    throw error;
  }
};

export { syncDatabase };
export default db;
export { User, WorkspaceMember, WorkspaceInvite, Whiteboard, TeachingSession, ProjectTask, CodeReview };
