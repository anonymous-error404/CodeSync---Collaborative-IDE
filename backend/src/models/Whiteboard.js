import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Whiteboard = sequelize.define('Whiteboard', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  workspaceId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Untitled Whiteboard',
  },
  mode: {
    type: DataTypes.ENUM('teach', 'development'),
    allowNull: false,
    defaultValue: 'development',
  },
  elements: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  viewport: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: { x: 0, y: 0, zoom: 1 },
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
});

export default Whiteboard;
