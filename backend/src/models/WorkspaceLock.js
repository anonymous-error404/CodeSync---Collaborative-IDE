import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class WorkspaceLock extends Model {}

WorkspaceLock.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    workspaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lockType: {
      type: DataTypes.ENUM('file', 'folder', 'code_block'),
      allowNull: false,
    },
    targetPath: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startLine: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    endLine: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    lockedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    lockedByName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'WorkspaceLock',
    tableName: 'workspace_locks',
    timestamps: true,
  }
);

export default WorkspaceLock;
