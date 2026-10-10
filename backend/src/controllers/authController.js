import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User } from '../models/index.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/authConfig.js';

// Email validation helper regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generate a signed JWT token for an authenticated user
 * @param {object} user
 * @returns {string}
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
};

/**
 * User Registration Controller
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are all required.',
      });
    }

    const trimmedUsername = String(username).trim();
    const trimmedEmail = String(email).trim().toLowerCase();

    // 2. Validate email format
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.',
      });
    }

    // 3. Validate username constraints
    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Username must be between 3 and 50 characters long.',
      });
    }

    // 4. Validate password length
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
      });
    }

    // 5. Check for duplicate email or username
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email: trimmedEmail }, { username: trimmedUsername }],
      },
    });

    if (existingUser) {
      if (existingUser.email.toLowerCase() === trimmedEmail) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists.',
        });
      }
      if (existingUser.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        return res.status(409).json({
          success: false,
          error: 'This username is already taken. Please choose another.',
        });
      }
    }

    // 6. Create User record (Password hashing handled in Sequelize model hooks)
    const newUser = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      password,
    });

    // 7. Generate JWT token
    const token = generateToken(newUser);

    // 8. Return response (password hash is omitted via User.prototype.toJSON)
    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: newUser.toJSON(),
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path || 'field';
      return res.status(409).json({
        success: false,
        error: `A user with this ${field} already exists.`,
      });
    }

    if (error.name === 'SequelizeValidationError') {
      const message = error.errors[0]?.message || 'Validation error.';
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    console.error('[Register Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while registering the user. Please try again later.',
    });
  }
};

/**
 * User Login Controller
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // 1. Validate input existence
    const identifier = email || username;
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email (or username) and password are required.',
      });
    }

    const trimmedIdentifier = String(identifier).trim();

    // 2. Find user by email or username using Sequelize
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: trimmedIdentifier.toLowerCase() },
          { username: trimmedIdentifier },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User not found.',
      });
    }

    // 3. Verify password securely using bcrypt
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Incorrect password.',
      });
    }

    // 4. Generate JWT token
    const token = generateToken(user);

    // 5. Return success response (omitting password hash)
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during login. Please try again later.',
    });
  }
};

/**
 * Get Current Authenticated User Session
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    // req.user is set by authenticateToken middleware
    return res.status(200).json({
      success: true,
      user: req.user.toJSON(),
    });
  } catch (error) {
    console.error('[GetMe Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while fetching user profile.',
    });
  }
};

export { register, login, getMe };
