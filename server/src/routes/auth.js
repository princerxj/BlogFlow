import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { csrfGuard, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimits.js';
import { validate } from '../middleware/validate.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User, publicUser } from '../models/User.js';
import { hashToken, newRefreshToken, signAccessToken } from '../services/tokens.js';
import { dummyHash, hashPassword, verifyPassword } from '../utils/passwords.js';

const router = Router();
const COOKIE = 'refresh_token';

// httpOnly: JavaScript (and therefore XSS) can't read it. path: only sent to /api/auth/*.
const cookieOptions = {
  httpOnly: true,
  secure: config.auth.cookieSecure,
  sameSite: config.auth.cookieSameSite,
  path: '/api/auth',
};

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const registerSchema = z.object({
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().trim().max(80).optional(),
});
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

/** Create a refresh token (stored hashed), set it as a cookie, and return the access token. */
async function startSession(res, user) {
  const refresh = newRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refresh),
    expiresAt: new Date(Date.now() + config.auth.refreshTtlMs),
  });
  res.cookie(COOKIE, refresh, { ...cookieOptions, maxAge: config.auth.refreshTtlMs });
  return { user: publicUser(user), accessToken: signAccessToken(user._id) };
}

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { email: addr, password, name } = req.body;
  let user;
  try {
    user = await User.create({ email: addr, name: name || '', passwordHash: await hashPassword(password) });
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'Email already registered');
    throw err;
  }
  res.status(201).json(await startSession(res, user));
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email: addr, password } = req.body;
  const user = await User.findOne({ email: addr }).select('+passwordHash');
  // Always do one scrypt verification, so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(password, user ? user.passwordHash : await dummyHash());
  if (!user || !ok) throw new AppError(401, 'Invalid email or password');
  res.json(await startSession(res, user));
});

// Rotation: each refresh token works exactly once. findOneAndDelete is atomic, so two
// simultaneous requests with the same token cannot both succeed.
router.post('/refresh', authLimiter, csrfGuard, async (req, res) => {
  const token = req.cookies?.[COOKIE];
  const record = token ? await RefreshToken.findOneAndDelete({ tokenHash: hashToken(token) }) : null;
  const user = record && record.expiresAt > new Date() ? await User.findById(record.user) : null;
  if (!user) {
    res.clearCookie(COOKIE, cookieOptions);
    throw new AppError(401, 'Session expired, please log in again');
  }
  res.json(await startSession(res, user));
});

router.post('/logout', csrfGuard, async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) await RefreshToken.deleteOne({ tokenHash: hashToken(token) });
  res.clearCookie(COOKIE, cookieOptions);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError(401, 'Account no longer exists');
  res.json({ user: publicUser(user) });
});

export default router;
