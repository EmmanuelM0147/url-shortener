import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';

const router = Router();

interface LinkRow {
  slug: string;
  target_url: string;
  expires_at: Date | null;
}

router.get('/:slug', (req: Request, res: Response, next: NextFunction): void => {
  const { slug } = req.params;

  query<LinkRow>(`SELECT slug, target_url, expires_at FROM links WHERE slug = $1`, [slug])
    .then((result) => {
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'Link not found' });
        return;
      }

      const link = result.rows[0];

      if (link.expires_at && new Date() > new Date(link.expires_at)) {
        res.status(404).json({ error: 'Link expired' });
        return;
      }

      const userAgent = req.headers['user-agent'] ?? null;

      return query(`UPDATE links SET click_count = click_count + 1 WHERE slug = $1`, [slug])
        .then(() =>
          query(`INSERT INTO click_events (slug, user_agent) VALUES ($1, $2)`, [slug, userAgent]),
        )
        .then(() => {
          res.redirect(302, link.target_url);
        });
    })
    .catch(next);
});

export default router;
