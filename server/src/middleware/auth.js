import { AppError } from '../errors.js';
import { verifyAccessToken } from '../services/tokens.js';

/** Require a valid access token; sets req.user = { id }. */
export function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(new AppError(401, 'Authentication required'));
  try {
    req.user = { id: verifyAccessToken(token).sub };
    next();
  } catch (err) {
    // `code` lets the React client know to call /auth/refresh instead of sending the user to login.
    const expired = err.name === 'TokenExpiredError';
    next(new AppError(401, expired ? 'Token expired' : 'Invalid token', { code: expired ? 'token_expired' : 'invalid_token' }));
  }
}

/**
 * CSRF guard for the cookie-authenticated endpoints (/auth/refresh, /auth/logout).
 * Browsers will not attach a custom header to a cross-site form post, and a cross-site
 * fetch with one must pass a CORS preflight, which only our own origin passes.
 */
export function csrfGuard(req, res, next) {
  if (!req.get('X-Requested-With')) return next(new AppError(403, 'Missing X-Requested-With header'));
  next();
}
