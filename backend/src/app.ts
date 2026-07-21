import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import apiRouter from './routes/index';

export function createApp() {
  const app = express();

  // Trust first proxy (needed for req.ip behind a reverse proxy or load balancer)
  app.set('trust proxy', 1);

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ── Parsers ───────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // ── Observability ─────────────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Rate limiting ─────────────────────────────────────────────────────────
  app.use(globalLimiter);

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/api', apiRouter);

  // ── 404 ───────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: 'Route not found',
    });
  });

  // ── Global error handler (must be last middleware) ─────────────────────────
  app.use(errorHandler);

  return app;
}
