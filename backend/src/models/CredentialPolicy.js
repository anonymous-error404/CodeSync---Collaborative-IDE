import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class CredentialPolicy extends Model {}

CredentialPolicy.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    environment: {
      type: DataTypes.ENUM('all', 'development', 'testing', 'staging', 'preview', 'production'),
      allowNull: false,
      defaultValue: 'all',
    },
    role: {
      type: DataTypes.STRING, // e.g. "developer", "team_leader", "tester", "all"
      allowNull: false,
      defaultValue: 'all',
    },
    workloadPattern: {
      type: DataTypes.STRING, // e.g. "spiffe://codesync.internal/ns/*/sa/*"
      allowNull: false,
      defaultValue: '*',
    },
    allowedResources: {
      type: DataTypes.JSON, // Array of regex or exact resources e.g. ["s3:*-dev-*", "pg:dev_*"]
      allowNull: false,
      defaultValue: ['*'],
    },
    allowedOperations: {
      type: DataTypes.JSON, // e.g. ["read", "list"]
      allowNull: false,
      defaultValue: ['read'],
    },
    requiresApproval: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    maxTtlMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'CredentialPolicy',
    tableName: 'credential_policies',
    timestamps: true,
  }
);

export default CredentialPolicy;
