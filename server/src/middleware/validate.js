import { AppError } from '../errors.js';

/** Validate req.body against a zod schema; replaces it with the parsed (trimmed, typed) data. */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return next(new AppError(400, 'Invalid request', { details }));
  }
  req.body = result.data;
  next();
};
