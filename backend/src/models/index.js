import sequelize from '../config/database.js';
import User from './User.js';
import WorkspaceMember from './WorkspaceMember.js';
import WorkspaceInvite from './WorkspaceInvite.js';
import Whiteboard from './Whiteboard.js';
import TeachingSession from './TeachingSession.js';
import ProjectTask from './ProjectTask.js';
import CodeReview from './CodeReview.js';
import WorkspaceLock from './WorkspaceLock.js';
import LineComment from './LineComment.js';

WorkspaceMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(WorkspaceMember, { foreignKey: 'userId' });

WorkspaceInvite.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
TeachingSession.belongsTo(User, { as: 'teacher', foreignKey: 'teacherUserId' });

// Professional workspace associations
ProjectTask.belongsTo(User, { as: 'assignee', foreignKey: 'assignedTo' });
ProjectTask.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
CodeReview.belongsTo(User, { as: 'author', foreignKey: 'authorId' });
CodeReview.belongsTo(User, { as: 'reviewer', foreignKey: 'reviewerId' });

WorkspaceLock.belongsTo(User, { as: 'locker', foreignKey: 'lockedBy' });

// Line Comment associations
LineComment.belongsTo(User, { as: 'author', foreignKey: 'userId' });
User.hasMany(LineComment, { foreignKey: 'userId' });
LineComment.hasMany(LineComment, { as: 'replies', foreignKey: 'parentId' });
LineComment.belongsTo(LineComment, { as: 'parent', foreignKey: 'parentId' });

const db = {
  sequelize,
  User,
  WorkspaceMember,
  WorkspaceInvite,
  Whiteboard,
  TeachingSession,
  ProjectTask,
  CodeReview,
  WorkspaceLock,
  LineComment,
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
    await sequelize.query('DROP TABLE IF EXISTS `workspace_locks_backup`;');

    await sequelize.sync(options);

    // Auto-migrate: ensure new columns exist in users
    try {
      const [userCols] = await sequelize.query("PRAGMA table_info('users');");
      const userColNames = (userCols || []).map(c => c.name);
      if (userColNames.length > 0) {
        if (!userColNames.includes('githubToken')) {
          await sequelize.query("ALTER TABLE users ADD COLUMN githubToken TEXT DEFAULT NULL;");
        }
        if (!userColNames.includes('githubUsername')) {
          await sequelize.query("ALTER TABLE users ADD COLUMN githubUsername TEXT DEFAULT NULL;");
        }
      }
    } catch (uErr) {
      console.warn('[Database Notice]: Column check on users:', uErr.message);
    }

    // Auto-migrate: ensure new columns exist in workspace_members
    try {
      const [cols] = await sequelize.query("PRAGMA table_info('workspace_members');");
      const colNames = (cols || []).map(c => c.name);

      if (colNames.length > 0) {
        if (!colNames.includes('studentAccess')) {
          await sequelize.query("ALTER TABLE workspace_members ADD COLUMN studentAccess TEXT DEFAULT 'viewer';");
        }
        if (!colNames.includes('sessionRole')) {
          await sequelize.query("ALTER TABLE workspace_members ADD COLUMN sessionRole TEXT DEFAULT 'none';");
        }
        if (!colNames.includes('editorLocked')) {
          await sequelize.query("ALTER TABLE workspace_members ADD COLUMN editorLocked TINYINT(1) DEFAULT 0;");
        }
        if (!colNames.includes('handRaised')) {
          await sequelize.query("ALTER TABLE workspace_members ADD COLUMN handRaised TINYINT(1) DEFAULT 0;");
        }
      }
    } catch (colErr) {
      console.warn('[Database Notice]: Column check on workspace_members:', colErr.message);
    }

    console.log('[Database]: Models synchronized with SQLite database.');
  } catch (error) {
    console.error('[Database Error]: Failed to connect or sync database:', error);
    throw error;
  }
};

export { syncDatabase };
export default db;
export { User, WorkspaceMember, WorkspaceInvite, Whiteboard, TeachingSession, ProjectTask, CodeReview, WorkspaceLock, LineComment };
