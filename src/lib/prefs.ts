import { eq } from 'drizzle-orm';
import { userPrefs } from '@/db/schema';
import type { Db } from '@/db/types';
import { parseHex } from './color';
import { AppError } from './errors';

export type Prefs = {
  themeH: number;
  themeS: number;
  themeL: number;
  /** 색상 코드로 고른 경우 입력값 그대로 보여 주기 위해 저장 */
  themeHex: string | null;
  weekStart: 'mon' | 'sun';
  /** null이면 자동(테마에 맞춤) */
  doingHex: string | null;
  doneHex: string | null;
};

export const DEFAULT_PREFS: Prefs = {
  themeH: 232, themeS: 55, themeL: 76, themeHex: null, weekStart: 'mon', doingHex: null, doneHex: null,
};

const HEX_MSG = '색상 코드는 # 뒤에 6자리로 입력하세요';

function intIn(v: unknown, min: number, max: number, label: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new AppError('invalid', `${label} 값이 올바르지 않습니다`);
  }
  return v;
}

function hexOrNull(v: unknown): string | null {
  if (v === null) return null;
  const hex = typeof v === 'string' ? parseHex(v) : null;
  if (!hex) throw new AppError('invalid', HEX_MSG);
  return hex;
}

export async function getPrefs(db: Db, userId: number): Promise<Prefs> {
  const [row] = await db.select().from(userPrefs).where(eq(userPrefs.userId, userId));
  if (!row) return { ...DEFAULT_PREFS };
  return {
    themeH: row.themeH, themeS: row.themeS, themeL: row.themeL, themeHex: row.themeHex,
    weekStart: row.weekStart, doingHex: row.doingHex, doneHex: row.doneHex,
  };
}

export async function savePrefs(db: Db, userId: number, patch: Partial<Prefs>, now: Date): Promise<Prefs> {
  const next: Prefs = { ...(await getPrefs(db, userId)) };
  if ('themeH' in patch) next.themeH = intIn(patch.themeH, 0, 359, '색상');
  if ('themeS' in patch) next.themeS = intIn(patch.themeS, 0, 100, '채도');
  if ('themeL' in patch) next.themeL = intIn(patch.themeL, 25, 90, '밝기');
  if ('themeHex' in patch) next.themeHex = hexOrNull(patch.themeHex);
  if ('doingHex' in patch) next.doingHex = hexOrNull(patch.doingHex);
  if ('doneHex' in patch) next.doneHex = hexOrNull(patch.doneHex);
  if ('weekStart' in patch) {
    if (patch.weekStart !== 'mon' && patch.weekStart !== 'sun') throw new AppError('invalid', '시작 요일이 올바르지 않습니다');
    next.weekStart = patch.weekStart;
  }
  await db.insert(userPrefs).values({ userId, ...next, updatedAt: now })
    .onConflictDoUpdate({ target: userPrefs.userId, set: { ...next, updatedAt: now } });
  return next;
}
