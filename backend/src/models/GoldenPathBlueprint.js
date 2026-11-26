import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class GoldenPathBlueprint extends Model {}

GoldenPathBlueprint.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true, // e.g. "gp-go-microservice"
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM(
        'backend',
        'frontend',
        'ai_ml',
        'data_pipeline',
        'mobile',
        'distributed',
        'infrastructure'
      ),
      allowNull: false,
      defaultValue: 'backend',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ownerTeam: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Platform Engineering',
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '1.0.0',
    },
    sourceProvider: {
      type: DataTypes.ENUM(
        'backstage',
        'cookiecutter',
        'copier',
        'yeoman',
        'terraform',
        'crossplane',
        'helm'
      ),
      allowNull: false,
      defaultValue: 'backstage',
    },
    tags: {
      type: DataTypes.JSON, // e.g. ["Go 1.22", "PostgreSQL", "gRPC", "Docker", "Kubernetes"]
      allowNull: false,
      defaultValue: [],
    },
    approved: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    deprecationNotice: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    inputsSchema: {
      type: DataTypes.JSON, // JSON schema for interactive wizard fields
      allowNull: false,
      defaultValue: [],
    },
    dependencyGraph: {
      type: DataTypes.JSON, // Required services and their provisioning order
      allowNull: false,
      defaultValue: [],
    },
    infrastructureSpec: {
      type: DataTypes.JSON, // Terraform/OpenTofu or Crossplane manifest blueprints
      allowNull: true,
      defaultValue: {},
    },
    ciCdSpec: {
      type: DataTypes.JSON, // GitHub Actions / GitLab CI pipeline steps
      allowNull: true,
      defaultValue: {},
    },
    securityPolicy: {
      type: DataTypes.JSON, // Default security hooks, secret scanning rules, RBAC
      allowNull: true,
      defaultValue: {},
    },
    compatibility: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: { runtimes: ['docker', 'native'], minMemory: '1GB' },
    },
  },
  {
    sequelize,
    modelName: 'GoldenPathBlueprint',
    tableName: 'golden_path_blueprints',
    timestamps: true,
  }
);

export default GoldenPathBlueprint;
