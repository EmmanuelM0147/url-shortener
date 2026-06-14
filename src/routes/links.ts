import { Router, Request, Response, NextFunction } from 'express';
import { customAlphabet } from 'nanoid';
import { query } from '../db';

const generateSlug = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
  7,
);

const router = Router();

interface LinkRow {
  id: number;
  slug: string;
  target_url: string;
  created_at: Date;
  expires_at: Date | null;
  click_count: number;
}

function getBaseUrl(): string {
  const base = process.env.BASE_URL || 'http://localhost:8080';
  return base.replace(/\/$/, '');
}

function toCreatedLink(row: LinkRow) {
  return {
    id: row.id,
    slug: row.slug,
    target_url: row.target_url,
    short_url: `${getBaseUrl()}/${row.slug}`,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

export function createLink(req: Request, res: Response, next: NextFunction): void {
  const { target_url, slug: customSlug, expires_at } = req.body as {
    target_url: string;
    slug?: string;
    expires_at?: string;
  };

  const slug = customSlug ?? generateSlug();
  const expiresAt = expires_at !== undefined ? new Date(expires_at) : null;

  query<LinkRow>(
    `INSERT INTO links (slug, target_url, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, slug, target_url, created_at, expires_at, click_count`,
    [slug, target_url, expiresAt],
  )
    .then((result) => {
      res.status(201).json(toCreatedLink(result.rows[0]));
    })
    .catch(next);
}

router.get('/', (_req: Request, res: Response, next: NextFunction): void => {
  query<LinkRow>(
    `SELECT id, slug, target_url, click_count, created_at, expires_at
     FROM links
     ORDER BY created_at DESC`,
  )
    .then((result) => {
      res.status(200).json(result.rows);
    })
    .catch(next);
});

router.get('/:slug/analytics', (req: Request, res: Response, next: NextFunction): void => {
  const { slug } = req.params;

  query<{ slug: string; click_count: number }>(
    `SELECT slug, click_count FROM links WHERE slug = $1`,
    [slug],
  )
    .then((linkResult) => {
      if (linkResult.rowCount === 0) {
        res.status(404).json({ error: 'Link not found' });
        return;
      }

      const { click_count } = linkResult.rows[0];

      return query<{ clicked_at: Date; user_agent: string | null }>(
        `SELECT clicked_at, user_agent
         FROM click_events
         WHERE slug = $1
         ORDER BY clicked_at DESC
         LIMIT 20`,
        [slug],
      ).then((clicksResult) => {
        res.status(200).json({
          slug,
          total_clicks: click_count,
          recent_clicks: clicksResult.rows,
        });
      });
    })
    .catch(next);
});

router.delete('/:slug', (req: Request, res: Response, next: NextFunction): void => {
  const { slug } = req.params;

  query(`DELETE FROM links WHERE slug = $1 RETURNING slug`, [slug])
    .then((result) => {
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Link not found' });
        return;
      }

      res.status(204).send();
    })
    .catch(next);
});

export default router;
