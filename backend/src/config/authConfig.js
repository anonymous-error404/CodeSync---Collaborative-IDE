import 'dotenv/config';

/**
 * Shared JWT configuration -- single source of truth.
 * Imported by authController and authMiddleware to prevent secret duplication.
 */
export const JWT_SECRET =
  process.env.JWT_SECRET || 'codesync_super_secret_jwt_key_2026_collaborative_ide';

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
