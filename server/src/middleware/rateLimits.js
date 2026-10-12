import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { AppError } from '../errors.js';

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'Too many requests. Please slow down and try again later.')),
};

/** Blanket protection per IP. */
export const globalLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: config.limits.globalMax });

/** Brute-force protection for register / login / refresh, per IP. */
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: config.limits.authMax });

/**
 * Protects your LLM bill: every call that makes the AI service run an agent counts.
 * Keyed by user (not IP) so it must run after requireAuth.
 */
export const llmLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: config.limits.llmMax,
  keyGenerator: (req) => req.user.id,
});
