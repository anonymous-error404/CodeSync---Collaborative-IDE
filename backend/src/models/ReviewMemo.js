import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class ReviewMemo extends Model {}

ReviewMemo.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    previewId: {
      type: DataTypes.UUID,
      allowNull: true,
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
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    objective: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    scope: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Universal Workspace Scope',
    },
    status: {
      type: DataTypes.ENUM('draft', 'in_review', 'approved', 'changes_requested', 'rejected'),
      allowNull: false,
      defaultValue: 'draft',
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    findingsSnapshot: {
      type: DataTypes.JSON, // Grouped array of findings captured during the review
      allowNull: true,
      defaultValue: [],
    },
    decisions: {
      type: DataTypes.JSON, // Array of formal decisions
      allowNull: true,
      defaultValue: [],
    },
    actionItems: {
      type: DataTypes.JSON, // Array of concrete action items
      allowNull: true,
      defaultValue: [],
    },
    conclusions: {
      type: DataTypes.JSON, // { outcome, blockingIssues: [], nonBlockingSuggestions: [], nextSteps: [] }
      allowNull: true,
      defaultValue: {},
    },
    manualNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    participants: {
      type: DataTypes.JSON, // Array of { userId, username, role, attendedAt }
      allowNull: true,
      defaultValue: [],
    },
    approvals: {
      type: DataTypes.JSON, // Array of { userId, username, approved: boolean, note, timestamp }
      allowNull: true,
      defaultValue: [],
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    finalizedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ReviewMemo',
    tableName: 'review_memos',
    timestamps: true,
  }
);

export default ReviewMemo;
