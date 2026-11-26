import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class IDPPolicy extends Model {}

IDPPolicy.init(
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
    ruleType: {
      type: DataTypes.ENUM(
        'language_version',
        'approved_framework',
        'security_scan_mandatory',
        'resource_limits',
        'dependency_restriction',
        'credential_broker_enforced'
      ),
      allowNull: false,
    },
    parameters: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    enforcement: {
      type: DataTypes.ENUM('mandatory', 'recommended'),
      allowNull: false,
      defaultValue: 'mandatory',
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
    modelName: 'IDPPolicy',
    tableName: 'idp_policies',
    timestamps: true,
  }
);

export default IDPPolicy;
