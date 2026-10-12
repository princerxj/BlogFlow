import { AppError } from '../errors.js';

export function notFound(req, res, next) {
  next(new AppError(404, 'Route not found'));
}

// Express 5 forwards rejected promises from async handlers here automatically.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
