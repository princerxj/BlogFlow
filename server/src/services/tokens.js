import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const ISSUER = 'blogflow';

/** Short-lived access token. Sent by the client in `Authorization: Bearer`. */
export function signAccessToken(userId) {
  return jwt.sign({}, config.auth.jwtSecret, {
    algorithm: 'HS256',
    subject: String(userId),
    issuer: ISSUER,
    expiresIn: config.auth.accessTtl,
  });
}

/** Pins the algorithm explicitly so a forged `alg: none` (or alg-swapped) token is rejected. */
export function verifyAccessToken(token) {
  return jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'], issuer: ISSUER });
}

/** Long-lived opaque refresh token (random, not a JWT: it is revocable because we store its hash). */
export const newRefreshToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
