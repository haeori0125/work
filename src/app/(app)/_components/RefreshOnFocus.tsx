'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** 다른 사람이 바꾼 내용을 보도록 창으로 돌아오면, 그리고 1분마다 새로고침한다. */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [router]);
  return null;
}
