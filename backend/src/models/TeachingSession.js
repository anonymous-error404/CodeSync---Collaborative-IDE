import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * TeachingSession — Represents an active education session inside a workspace.
 *
 * A teaching session is orthogonal to workspace membership roles (owner/editor/viewer).
 * Any workspace member can be assigned a sessionRole of 'teacher' or 'student'.
 * The session tracks state like focus mode, locked editors, and raised hands.
 */
class TeachingSession extends Model {}

TeachingSession.init(
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
      unique: true, // only one active session per workspace
    },
    teacherUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Focus mode: students can only see the file the teacher has open
    focusMode: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // The file path the teacher is currently focused on (broadcasted in focus mode)
    focusedFilePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'TeachingSession',
    tableName: 'teaching_sessions',
    timestamps: true,
  }
);

export default TeachingSession;
