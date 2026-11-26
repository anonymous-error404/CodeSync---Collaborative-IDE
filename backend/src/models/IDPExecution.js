import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class IDPExecution extends Model {}

IDPExecution.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    blueprintId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    blueprintVersion: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workspaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    projectName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'provisioning', 'completed', 'failed', 'drifted', 'updating'),
      allowNull: false,
      defaultValue: 'pending',
    },
    parameters: {
      type: DataTypes.JSON, // Inputs chosen during wizard
      allowNull: false,
      defaultValue: {},
    },
    provisionedServices: {
      type: DataTypes.JSON, // Array of { serviceId, name, status, endpoint, port, health }
      allowNull: true,
      defaultValue: [],
    },
    dependencyGraphStatus: {
      type: DataTypes.JSON, // Realtime node state in dependency DAG
      allowNull: true,
      defaultValue: {},
    },
    logs: {
      type: DataTypes.JSON, // Array of { timestamp, stage, message, level }
      allowNull: true,
      defaultValue: [],
    },
    driftStatus: {
      type: DataTypes.JSON, // { hasDrift: boolean, outdatedDependencies: [], missingConfigs: [], driftDetails: [] }
      allowNull: true,
      defaultValue: { hasDrift: false },
    },
    upstreamUpdatesAvailable: {
      type: DataTypes.JSON, // { latestVersion: string, changelog: string[], breakingChanges: boolean }
      allowNull: true,
      defaultValue: null,
    },
    initiatedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'IDPExecution',
    tableName: 'idp_executions',
    timestamps: true,
  }
);

export default IDPExecution;
