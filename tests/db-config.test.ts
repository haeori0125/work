import { afterEach, describe, expect, it, vi } from 'vitest';

describe('getDb on Vercel', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it('refuses to fall back to a local file DB when no database URL is set', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('POSTGRES_URL', '');
    const { getDb } = await import('@/db');
    await expect(getDb()).rejects.toThrow(/DATABASE_URL/);
  });
});
