import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class PreviewAnnotation extends Model {}

PreviewAnnotation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    previewId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    workspaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    revisionId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'rev-init',
    },
    surface: {
      type: DataTypes.ENUM(
        'web',
        'mobile',
        'desktop',
        'api',
        'terminal',
        'logs',
        'database',
        'ml',
        'infrastructure'
      ),
      allowNull: false,
      defaultValue: 'web',
    },
    type: {
      type: DataTypes.ENUM('bug', 'suggestion', 'change_request', 'observation'),
      allowNull: false,
      defaultValue: 'bug',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    coordinates: {
      type: DataTypes.JSON, // { x: number, y: number, viewportWidth: number, viewportHeight: number, selector?: string, route?: string }
      allowNull: true,
      defaultValue: null,
    },
    technicalContext: {
      type: DataTypes.JSON, // { endpoint, method, statusCode, requestBody, responseBody, logLine, logTrace, dbTable, query, filePath, lineNumber, executionId }
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'reopened', 'verified', 'closed'),
      allowNull: false,
      defaultValue: 'open',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: false,
      defaultValue: 'medium',
    },
    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    replies: {
      type: DataTypes.JSON, // Array of { id, userId, username, comment, createdAt }
      allowNull: true,
      defaultValue: [],
    },
    decision: {
      type: DataTypes.JSON, // { outcome: 'accepted'|'rejected'|'deferred'|'investigation', reasonedBy: number, reasoning: string, decidedAt: string }
      allowNull: true,
      defaultValue: null,
    },
    actionItem: {
      type: DataTypes.JSON, // { description: string, assignedTo: number, dueDate: string, verifiedRevision?: string, completed: boolean }
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'PreviewAnnotation',
    tableName: 'preview_annotations',
    timestamps: true,
  }
);

export default PreviewAnnotation;
