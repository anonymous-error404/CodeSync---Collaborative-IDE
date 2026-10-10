import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class WorkspaceMember extends Model {}

WorkspaceMember.init(
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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('owner', 'editor', 'viewer'),
      allowNull: false,
      defaultValue: 'viewer',
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    }
  },
  {
    sequelize,
    modelName: 'WorkspaceMember',
    tableName: 'workspace_members',
    timestamps: false,
  }
);

export default WorkspaceMember;
