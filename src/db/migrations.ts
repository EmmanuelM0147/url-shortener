import { query } from './index';

export async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS links (
      id          SERIAL PRIMARY KEY,
      slug        VARCHAR(20) UNIQUE NOT NULL,
      target_url  TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NULL,
      click_count INTEGER DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS click_events (
      id          SERIAL PRIMARY KEY,
      slug        VARCHAR(20) NOT NULL REFERENCES links(slug) ON DELETE CASCADE,
      clicked_at  TIMESTAMPTZ DEFAULT NOW(),
      user_agent  TEXT
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_links_expires_at ON links(expires_at)
  `);
}
