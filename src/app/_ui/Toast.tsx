'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckIcon } from './icons';

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

/** "저장되었습니다" 같은 알림을 화면 위쪽 가운데에 잠깐 띄운다 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  // 열린 팝업창(dialog) 위에도 보이도록 popover로 맨 위 층에 올린다
  useEffect(() => {
    const el = box.current;
    if (!el?.showPopover) return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (list.length) el.showPopover();
    } catch { /* popover를 모르는 브라우저는 그냥 fixed로 보인다 */ }
  }, [list]);
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current;
    setList((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2400);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div ref={box} className="toasts" popover="manual" aria-live="polite">
        {list.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.tone === 'ok' && <span className="toast-ic" aria-hidden><CheckIcon size={10} /></span>}{t.text}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** 서버에서 이동해 온 뒤(예: ?saved=new) 알림을 띄우고 주소에서 그 값을 지운다 */
export function FlashToast({ param, value, messages }: { param: string; value: string | undefined; messages: Record<string, string> }) {
  const toast = useToast();
  const router = useRouter();
  useEffect(() => {
    if (!value) return;
    toast(messages[value] ?? messages.default ?? '저장되었습니다');
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    router.replace(url.pathname + url.search, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return null;
}
