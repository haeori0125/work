import { eq, isNotNull } from 'drizzle-orm';
import { userPrefs, users } from '@/db/schema';
import type { Db } from '@/db/types';
import { parseHex } from './color';
import { AppError } from './errors';

export { DEFAULT_PREFS, type Prefs } from './prefs-shared';
import { DEFAULT_PREFS, type Prefs } from './prefs-shared';

// png/jpeg/webp data URL만, 약 60KB까지 (화면에서 160px로 줄여 보내면 보통 10KB 안팎)
const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_AVATAR = 80000;

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
    weekStart: row.weekStart, doingHex: row.doingHex, doneHex: row.doneHex, avatar: row.avatar,
    weekFilter: parseFilter(row.weekFilter),
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
  if ('avatar' in patch) {
    const a = patch.avatar;
    if (a !== null && (typeof a !== 'string' || a.length > MAX_AVATAR || !AVATAR_RE.test(a))) {
      throw new AppError('invalid', '사진을 저장하지 못했습니다. 다른 사진으로 다시 시도하세요.');
    }
    next.avatar = a;
  }
  if ('weekFilter' in patch) {
    const f = patch.weekFilter;
    if (f !== null && (!Array.isArray(f) || f.length > 100 || f.some((n) => typeof n !== 'string' || !n || n.length > 30))) {
      throw new AppError('invalid', '필터를 저장하지 못했습니다');
    }
    next.weekFilter = f === null ? null : [...new Set(f)];
  }
  if ('weekStart' in patch) {
    if (patch.weekStart !== 'mon' && patch.weekStart !== 'sun') throw new AppError('invalid', '시작 요일이 올바르지 않습니다');
    next.weekStart = patch.weekStart;
  }
  const row = { ...next, weekFilter: next.weekFilter === null ? null : JSON.stringify(next.weekFilter) };
  await db.insert(userPrefs).values({ userId, ...row, updatedAt: now })
    .onConflictDoUpdate({ target: userPrefs.userId, set: { ...row, updatedAt: now } });
  return next;
}

/** 이름 → 프로필 사진. 사진을 올린 사람만 담긴다(이름은 모임 안에서 유일). */
export async function getAvatarMap(db: Db): Promise<Record<string, string>> {
  const rows = await db.select({ name: users.name, avatar: userPrefs.avatar })
    .from(userPrefs).innerJoin(users, eq(users.id, userPrefs.userId)).where(isNotNull(userPrefs.avatar));
  return Object.fromEntries(rows.map((r) => [r.name, r.avatar!]));
}

function parseFilter(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}
