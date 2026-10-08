import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class WorkspaceInvite extends Model {}

WorkspaceInvite.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    workspaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('editor', 'viewer'),
      allowNull: false,
      defaultValue: 'editor',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    maxUses: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    usedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'WorkspaceInvite',
    tableName: 'workspace_invites',
    timestamps: true,
  }
);

export default WorkspaceInvite;
