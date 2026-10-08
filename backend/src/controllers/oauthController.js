import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { User } from '../models/index.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/authConfig.js';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, FRONTEND_URL } from '../config/oauthConfig.js';
import asyncWrapper from '../utils/asyncWrapper.js';

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

const isOAuthReady = () => {
  return Boolean(
    GOOGLE_CLIENT_ID &&
    GOOGLE_CLIENT_ID.trim() !== '' &&
    GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
    GOOGLE_CLIENT_SECRET &&
    GOOGLE_CLIENT_SECRET.trim() !== '' &&
    GOOGLE_CLIENT_SECRET !== 'your_google_client_secret'
  );
};

/**
 * Initiates the Google OAuth2 flow or development demo login.
 */
export const googleRedirect = asyncWrapper(async (req, res) => {
  const allowDevDemo = req.query.demo === 'true';

  if (!isOAuthReady()) {
    if (allowDevDemo) {
      // Simulate Google OAuth for local development / testing without Google Cloud setup
      const demoEmail = 'google.dev.user@example.com';
      let user = await User.findOne({ where: { email: demoEmail } });
      if (!user) {
        user = await User.create({
          username: 'google_dev_user',
          email: demoEmail,
          password: crypto.randomUUID(),
        });
      }
      const token = generateToken(user);
      return res.redirect(`${FRONTEND_URL}/?token=${token}`);
    }

    console.warn('[Google OAuth] Client ID / Secret missing or set to placeholder in backend/.env');
    const msg = 'Google OAuth is not configured. Please add valid GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env, or use the Demo Google Account button.';
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(msg)}&oauth_unconfigured=true`);
  }

  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
});

/**
 * Handles the Google OAuth2 callback.
 */
export const googleCallback = asyncWrapper(async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('[Google OAuth Error Callback]:', error, error_description);
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent('No authorization code provided by Google.')}`);
  }

  // 1. Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code.toString(),
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    console.error('[Google Token Exchange Failed]:', tokenResponse.status, errText);
    let errMsg = 'Google token exchange failed';
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error_description) errMsg = parsed.error_description;
      else if (parsed.error) errMsg = parsed.error;
    } catch {}
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(errMsg)}`);
  }

  const tokenData = await tokenResponse.json();

  // 2. Fetch user profile from Google
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userResponse.ok) {
    const errText = await userResponse.text();
    console.error('[Google UserInfo Failed]:', userResponse.status, errText);
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent('Failed to fetch user profile from Google')}`);
  }

  const userData = await userResponse.json();
  const email = (userData.email || '').toLowerCase();

  if (!email) {
    return res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent('No email address provided by Google profile')}`);
  }

  let user = await User.findOne({ where: { email } });

  if (!user) {
    // Generate clean username (3-50 characters, letters, numbers, underscore)
    let cleanName = (userData.name || userData.given_name || email.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (cleanName.length < 3) {
      cleanName = `user_${cleanName}`;
    }
    if (cleanName.length > 40) {
      cleanName = cleanName.substring(0, 40);
    }

    let username = cleanName;
    let isTaken = await User.findOne({ where: { username } });
    while (isTaken) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      username = `${cleanName.substring(0, 35)}_${suffix}`;
      isTaken = await User.findOne({ where: { username } });
    }

    const randomPassword = crypto.randomUUID();

    user = await User.create({
      username,
      email,
      password: randomPassword,
    });
  }

  const jwtToken = generateToken(user);
  res.redirect(`${FRONTEND_URL}/?token=${jwtToken}`);
});
