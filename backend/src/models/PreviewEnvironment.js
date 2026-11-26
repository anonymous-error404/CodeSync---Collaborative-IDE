import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class PreviewEnvironment extends Model {}

PreviewEnvironment.init(
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
    revisionId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'rev-init',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        'web',
        'backend',
        'mobile',
        'desktop',
        'database',
        'cli',
        'ml',
        'distributed',
        'infrastructure'
      ),
      allowNull: false,
      defaultValue: 'web',
    },
    status: {
      type: DataTypes.ENUM('provisioning', 'ready', 'failed', 'terminated'),
      allowNull: false,
      defaultValue: 'ready',
    },
    targetUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    runtimeConfig: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    healthStatus: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: { status: 'healthy', latencyMs: 24, uptimeSeconds: 120 },
    },
    resourceLimits: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: { cpu: '0.5 vCPU', memory: '512MB', storage: '1GB' },
    },
    accessPolicy: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: { mode: 'organization_only', allowComments: true, canRunTests: true },
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'PreviewEnvironment',
    tableName: 'preview_environments',
    timestamps: true,
  }
);

export default PreviewEnvironment;
