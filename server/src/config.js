// Central, validated configuration. Fail fast at boot instead of failing mid-request.
import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const num = (name, fallback) => (process.env[name] ? Number(process.env[name]) : fallback);

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters (try: openssl rand -base64 48)');

const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase(); // lax | strict | none
if (!['lax', 'strict', 'none'].includes(cookieSameSite)) throw new Error('COOKIE_SAMESITE must be lax, strict or none');

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  isProd,
  port: num('PORT', 4000),
  mongoUri: required('MONGODB_URI'),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  // Number of reverse proxies in front of the API (so rate limits see the real client IP). Off by default.
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false,

  ai: {
    baseUrl: required('AI_SERVICE_URL').replace(/\/$/, ''),
    internalKey: process.env.AI_INTERNAL_KEY || '',
    timeoutMs: num('AI_TIMEOUT_MS', 120000),
  },

  auth: {
    jwtSecret,
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtlMs: num('REFRESH_TTL_DAYS', 7) * 24 * 60 * 60 * 1000,
    cookieSameSite,
    cookieSecure: isProd || cookieSameSite === 'none', // browsers require Secure with SameSite=None
  },

  limits: {
    globalMax: num('GLOBAL_RATE_MAX', 300), // requests / 15 min / IP
    authMax: num('AUTH_RATE_MAX', 20), // register+login+refresh attempts / 15 min / IP
    llmMax: num('LLM_RATE_MAX', 30), // LLM-triggering calls / hour / user
    maxProjectsPerUser: num('MAX_PROJECTS_PER_USER', 50),
  },
};
