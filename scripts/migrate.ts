import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('[migrate] DATABASE_URL not set — skipping (local PGlite migrates at runtime)');
    return;
  }
  const client = postgres(url, { prepare: false, max: 1 });
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  await client.end();
  console.log('[migrate] done');
}

main().catch((e) => { console.error(e); process.exit(1); });
