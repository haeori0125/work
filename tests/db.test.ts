import { describe, expect, it } from 'vitest';
import { createTestDb } from './helpers/db';
import { users } from '@/db/schema';

describe('test database', () => {
  it('applies migrations and uses user defaults', async () => {
    const db = await createTestDb();
    await db.insert(users).values({ name: 'a', passwordHash: 'x' });
    const [row] = await db.select().from(users);
    expect(row.status).toBe('pending');
    expect(row.role).toBe('member');
  });
});
