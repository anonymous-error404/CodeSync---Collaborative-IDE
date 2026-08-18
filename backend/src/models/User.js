import { DataTypes, Model } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';

class User extends Model {
  /**
   * Compare plain password with stored hash
   * @param {string} plainPassword
   * @returns {Promise<boolean>}
   */
  async validatePassword(plainPassword) {
    return bcrypt.compare(plainPassword, this.password);
  }

  /**
   * Sanitize user JSON to omit password hash
   */
  toJSON() {
    const values = { ...this.get() };
    delete values.password;
    return values;
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: {
        name: 'users_username_unique',
        msg: 'Username is already taken',
      },
      validate: {
        notNull: { msg: 'Username is required' },
        notEmpty: { msg: 'Username cannot be empty' },
        len: {
          args: [3, 50],
          msg: 'Username must be between 3 and 50 characters long',
        },
      },
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: {
        name: 'users_email_unique',
        msg: 'Email is already registered',
      },
      validate: {
        notNull: { msg: 'Email is required' },
        notEmpty: { msg: 'Email cannot be empty' },
        isEmail: { msg: 'Please provide a valid email address' },
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notNull: { msg: 'Password is required' },
        notEmpty: { msg: 'Password cannot be empty' },
        len: {
          args: [6, 255],
          msg: 'Password must be at least 6 characters long',
        },
      },
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

export default User;
