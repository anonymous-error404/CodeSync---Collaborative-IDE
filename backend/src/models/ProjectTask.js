import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class ProjectTask extends Model {}

ProjectTask.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    workspaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('todo', 'in_progress', 'in_review', 'done'),
      allowNull: false,
      defaultValue: 'todo',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    sprint: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Sprint 1',
    },
    storyPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ProjectTask',
    tableName: 'project_tasks',
    timestamps: true,
  }
);

// Gracefully ensure new columns exist on existing databases
setTimeout(async () => {
  try {
    await sequelize.query('ALTER TABLE project_tasks ADD COLUMN sprint VARCHAR(255) DEFAULT "Sprint 1";');
  } catch {
    /* column already exists */
  }
  try {
    await sequelize.query('ALTER TABLE project_tasks ADD COLUMN storyPoints INTEGER DEFAULT 3;');
  } catch {
    /* column already exists */
  }
}, 500);

export default ProjectTask;