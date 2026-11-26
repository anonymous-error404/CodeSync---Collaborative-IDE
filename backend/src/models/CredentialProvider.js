import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class CredentialProvider extends Model {}

CredentialProvider.init(
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
    providerType: {
      type: DataTypes.ENUM(
        'aws_iam',
        'gcp_iam',
        'azure_vault',
        'hashicorp_vault',
        'postgres_db',
        'mysql_db',
        'stripe',
        'twilio',
        'custom_api',
        'oauth'
      ),
      allowNull: false,
    },
    environment: {
      type: DataTypes.ENUM('development', 'testing', 'staging', 'preview', 'production'),
      allowNull: false,
      defaultValue: 'development',
    },
    config: {
      type: DataTypes.JSON, // Masked or encrypted configuration, regions, endpoints
      allowNull: true,
      defaultValue: {},
    },
    status: {
      type: DataTypes.ENUM('active', 'degraded', 'disabled', 'unhealthy'),
      allowNull: false,
      defaultValue: 'active',
    },
    isHealthy: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    rotationPolicy: {
      type: DataTypes.JSON, // { autoRotate: boolean, rotationIntervalDays: number, lastRotatedAt: string }
      allowNull: true,
      defaultValue: { autoRotate: true, rotationIntervalDays: 30 },
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'CredentialProvider',
    tableName: 'credential_providers',
    timestamps: true,
  }
);

export default CredentialProvider;
