'use client';

import { useEffect } from 'react';
import { THEME_COOKIE } from '@/lib/theme-cookie';

/** 이 기기에서 마지막으로 쓴 테마 색을 기억해 둔다(로그인 화면용) */
export function RememberTheme({ value }: { value: string }) {
  useEffect(() => {
    document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
  }, [value]);
  return null;
}
