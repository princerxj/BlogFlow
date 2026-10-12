import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimits.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';

export const app = express();

if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

app.use(helmet());
// credentials: true lets the browser send the refresh cookie; origins must be explicit (no "*").
app.use(cors({ origin: config.clientOrigins, credentials: true }));

app.get('/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
});

app.use(globalLimiter);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use(notFound);
app.use(errorHandler);
