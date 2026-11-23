// 빌드 직전에 DB 마이그레이션을 적용한다. (순수 Node 실행 — tsx/esbuild 불필요)
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!url && process.env.VERCEL) {
  console.error('[migrate] DATABASE_URL is not set on Vercel — connect a Neon database in Storage, then redeploy.');
  process.exit(1);
}
if (!url) {
  console.log('[migrate] DATABASE_URL/POSTGRES_URL not set — skipping (local PGlite migrates at runtime)');
  process.exit(0);
}

try {
  const client = postgres(url, { prepare: false, max: 1 });
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  await client.end();
  console.log('[migrate] done');
} catch (e) {
  console.error('[migrate] failed:', e);
  process.exit(1);
}
