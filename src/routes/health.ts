import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  query('SELECT 1')
    .then(() => {
      res.status(200).json({
        status: 'ok',
        db: 'connected',
        uptime: process.uptime(),
      });
    })
    .catch(() => {
      res.status(503).json({
        status: 'degraded',
        db: 'disconnected',
        uptime: process.uptime(),
      });
    });
});

export default router;
