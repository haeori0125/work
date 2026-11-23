import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

const SRC = path.join(__dirname, '../drizzle');

/** 앞의 n개 마이그레이션만 담은 임시 폴더 */
function migrationsUpTo(n: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  fs.mkdirSync(path.join(dir, 'meta'));
  const journal = JSON.parse(fs.readFileSync(path.join(SRC, 'meta/_journal.json'), 'utf8'));
  journal.entries = journal.entries.slice(0, n);
  fs.writeFileSync(path.join(dir, 'meta/_journal.json'), JSON.stringify(journal));
  for (const e of journal.entries) fs.copyFileSync(path.join(SRC, `${e.tag}.sql`), path.join(dir, `${e.tag}.sql`));
  return dir;
}

describe('data migration to segments and notes', () => {
  it('moves attendance, edits and personal memos, then drops the old tables', async () => {
    const client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: migrationsUpTo(2) });
    await client.exec(`
      INSERT INTO users (id, name, password_hash, status) VALUES (1, '철수', 'x', 'active'), (2, '운영자', 'x', 'active');
      INSERT INTO attendance (id, user_id, date, clock_in, clock_out) VALUES
        (10, 1, '2026-11-20', '2026-11-20T00:00:00Z', '2026-11-20T09:00:00Z'),
        (11, 1, '2026-11-21', '2026-11-21T00:30:00Z', NULL);
      INSERT INTO attendance_edits (attendance_id, edited_by, at, old_clock_in, old_clock_out)
        VALUES (10, 2, '2026-11-21T01:00:00Z', '2026-11-20T00:00:00Z', NULL);
      INSERT INTO personal_memos (user_id, body, updated_at) VALUES (1, '내 메모', '2026-11-22T00:00:00Z'), (2, '   ', '2026-11-22T00:00:00Z');
    `);
    await migrate(db, { migrationsFolder: SRC });

    const segs = (await client.query<{ date: string; clock_out: Date | null }>(
      'SELECT date, clock_out FROM work_segments ORDER BY date')).rows;
    expect(segs.map((r) => r.date)).toEqual(['2026-11-20', '2026-11-21']);
    expect(segs[1].clock_out).toBeNull();
    const edits = (await client.query<{ date: string }>(
      'SELECT ws.date FROM segment_edits e JOIN work_segments ws ON ws.id = e.segment_id')).rows;
    expect(edits).toEqual([{ date: '2026-11-20' }]);
    const notes = (await client.query<{ user_id: number; body: string }>('SELECT user_id, body FROM notes')).rows;
    expect(notes).toEqual([{ user_id: 1, body: '내 메모' }]);
    const old = (await client.query<{ a: string | null; p: string | null }>(
      "SELECT to_regclass('attendance')::text AS a, to_regclass('personal_memos')::text AS p")).rows[0];
    expect(old).toEqual({ a: null, p: null });
  });
});
