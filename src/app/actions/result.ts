import { AppError } from '@/lib/errors';

export type ActionResult = { error?: string; ok?: string } | null;

/** AppError는 화면에 보여줄 메시지로 바꾸고, 그 밖의 오류는 그대로 던진다. */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const ok = await fn();
    return ok ? { ok } : {};
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}
