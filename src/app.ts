import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { validateCreateLink } from './middleware/validate';
import { createLinkRateLimiter } from './middleware/rateLimiter';
import healthRouter from './routes/health';
import linksRouter, { createLink } from './routes/links';
import redirectRouter from './routes/redirect';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use('/health', healthRouter);
  app.post('/api/links', createLinkRateLimiter, validateCreateLink, createLink);
  app.use('/api/links', linksRouter);
  app.use('/', redirectRouter);

  app.use(errorHandler);

  return app;
}
