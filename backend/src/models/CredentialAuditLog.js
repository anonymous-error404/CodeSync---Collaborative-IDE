import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class CredentialAuditLog extends Model {}

CredentialAuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    workspaceId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    workloadIdentity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    providerType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    resourceTarget: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    operation: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    environment: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'development',
    },
    action: {
      type: DataTypes.ENUM('allowed', 'denied', 'revoked', 'leaked_blocked', 'emergency_lockdown'),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '127.0.0.1',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: 'CredentialAuditLog',
    tableName: 'credential_audit_logs',
    timestamps: true,
  }
);

export default CredentialAuditLog;
