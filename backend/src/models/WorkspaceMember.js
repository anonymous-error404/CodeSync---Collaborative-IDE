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
      type: DataTypes.ENUM('owner', 'admin', 'editor', 'viewer'),
      allowNull: false,
      defaultValue: 'viewer',
    },
    // Education session role — orthogonal to workspace RBAC role
    sessionRole: {
      type: DataTypes.ENUM('teacher', 'student', 'none'),
      allowNull: false,
      defaultValue: 'none',
    },
    // Education editor lock state: if true, student editor is read-only
    editorLocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Education hand raised state
    handRaised: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
