import { ErrorRequestHandler } from 'express';
import { DatabaseError } from 'pg';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);

  if (err instanceof DatabaseError) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Slug already taken' });
      return;
    }

    if (err.code === '23503') {
      res.status(409).json({ error: 'Conflict' });
      return;
    }

    if (err.code === '22001') {
      res.status(400).json({
        error: 'slug must be between 3 and 20 characters',
        field: 'slug',
      });
      return;
    }
  }

  res.status(500).json({ error: 'Internal server error' });
};
