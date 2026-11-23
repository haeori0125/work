import { addDays } from './time';

/** "2026-11" → { from: "2026-11-01", to: "2026-11-30" }. 형식이 틀리면 null */
export function monthRange(month: string): { from: string; to: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  const from = `${month}-01`;
  const y = Number(m[1]);
  const next = Number(m[2]) === 12 ? `${y + 1}-01-01` : `${y}-${String(Number(m[2]) + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

export function shiftMonth(month: string, n: number): string {
  const [y, mm] = month.split('-').map(Number);
  const idx = y * 12 + (mm - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
