import path from 'node:path';
import * as schema from './schema';
import type { Db } from './types';

export type { Db };

const MIGRATIONS = path.join(process.cwd(), 'drizzle');

let dbPromise: Promise<Db> | null = null;

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url && process.env.VERCEL) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다. Vercel Storage에서 Neon 데이터베이스를 연결하세요.');
  }
  if (url) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    return drizzle(postgres(url, { prepare: false, max: 5 }), { schema }) as unknown as Db;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite(process.env.PGLITE_DIR ?? path.join(process.cwd(), '.pglite'));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  dbPromise ??= connect();
  return dbPromise;
}
