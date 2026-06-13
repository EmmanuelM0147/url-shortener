import { Request, Response, NextFunction } from 'express';

const SLUG_PATTERN = /^[a-zA-Z0-9-]+$/;

export function validateCreateLink(req: Request, res: Response, next: NextFunction): void {
  const { target_url, slug, expires_at } = req.body as {
    target_url?: unknown;
    slug?: unknown;
    expires_at?: unknown;
  };

  if (target_url === undefined || target_url === null || target_url === '') {
    res.status(400).json({ error: 'target_url is required', field: 'target_url' });
    return;
  }

  if (typeof target_url !== 'string') {
    res.status(400).json({ error: 'target_url must be a string', field: 'target_url' });
    return;
  }

  try {
    new URL(target_url);
  } catch {
    res.status(400).json({ error: 'target_url must be a valid URL', field: 'target_url' });
    return;
  }

  if (slug !== undefined && slug !== null) {
    if (typeof slug !== 'string') {
      res.status(400).json({ error: 'slug must be a string', field: 'slug' });
      return;
    }

    if (slug.length < 3 || slug.length > 50) {
      res.status(400).json({ error: 'slug must be between 3 and 50 characters', field: 'slug' });
      return;
    }

    if (!SLUG_PATTERN.test(slug)) {
      res.status(400).json({
        error: 'slug must contain only alphanumeric characters and hyphens',
        field: 'slug',
      });
      return;
    }
  }

  if (expires_at !== undefined && expires_at !== null) {
    if (typeof expires_at !== 'string') {
      res.status(400).json({ error: 'expires_at must be an ISO8601 string', field: 'expires_at' });
      return;
    }

    const expiresAt = new Date(expires_at);
    if (Number.isNaN(expiresAt.getTime())) {
      res.status(400).json({ error: 'expires_at must be a valid ISO8601 date', field: 'expires_at' });
      return;
    }

    if (expiresAt <= new Date()) {
      res.status(400).json({ error: 'expires_at must be a future date', field: 'expires_at' });
      return;
    }
  }

  next();
}
