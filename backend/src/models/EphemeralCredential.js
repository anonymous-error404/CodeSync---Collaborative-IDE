import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class EphemeralCredential extends Model {}

EphemeralCredential.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    workspaceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    workloadIdentity: {
      type: DataTypes.STRING, // e.g. "spiffe://codesync.internal/ns/default/sa/payment-api"
      allowNull: false,
    },
    resourceTarget: {
      type: DataTypes.STRING, // e.g. "s3:payment-dev-bucket", "pg:payment_db:customers"
      allowNull: false,
    },
    environment: {
      type: DataTypes.ENUM('development', 'testing', 'staging', 'preview', 'production'),
      allowNull: false,
      defaultValue: 'development',
    },
    permissions: {
      type: DataTypes.JSON, // e.g. ["read", "write", "list"]
      allowNull: false,
      defaultValue: ['read'],
    },
    maskedToken: {
      type: DataTypes.STRING, // Masked representation e.g. "cs_eph_9f2...84a"
      allowNull: false,
    },
    rawSecretRef: {
      type: DataTypes.STRING, // In-memory or vault-vaulted broker pointer (never stored raw in plain files)
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'revoked'),
      allowNull: false,
      defaultValue: 'active',
    },
    requestReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    issuedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    issuedToUser: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'EphemeralCredential',
    tableName: 'ephemeral_credentials',
    timestamps: true,
  }
);

export default EphemeralCredential;
