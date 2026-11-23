import { users } from '@/db/schema';
import type { Db } from '@/db/types';

export async function makeUser(
  db: Db,
  name: string,
  opts: { role?: 'member' | 'admin'; status?: 'pending' | 'active' | 'disabled' } = {},
): Promise<number> {
  const [row] = await db.insert(users).values({
    name, passwordHash: 'x', role: opts.role ?? 'member', status: opts.status ?? 'active',
  }).returning({ id: users.id });
  return row.id;
}

export const at = (iso: string) => new Date(iso);
