import 'dotenv/config';
import { createApp } from './app';
import { pool } from './db';
import { runMigrations } from './db/migrations';

const PORT = Number(process.env.PORT) || 8080;

async function start(): Promise<void> {
  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration failed:', err);
    await pool.end();
    process.exit(1);
  }

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  void pool.end();
  process.exit(1);
});
