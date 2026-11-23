'use client';

import { createContext, useContext } from 'react';

const AvatarContext = createContext<Record<string, string>>({});

/** 이름 → 프로필 사진 지도를 화면 전체에 나눠 준다 */
export function AvatarProvider({ map, children }: { map: Record<string, string>; children: React.ReactNode }) {
  return <AvatarContext.Provider value={map}>{children}</AvatarContext.Provider>;
}

/** 작은 프로필 사진(없으면 이름 첫 글자 동그라미) */
export function MiniAvatar({ name, size = 16 }: { name: string; size?: number }) {
  const src = useContext(AvatarContext)[name];
  const style = { width: size, height: size, fontSize: Math.round(size * 0.6) };
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="mini-av" src={src} alt="" style={style} />
    : <span className="mini-av letter" style={style} aria-hidden="true">{name.slice(0, 1)}</span>;
}

/** 사진 + 이름 */
export function Person({ name, size = 16 }: { name: string; size?: number }) {
  return <span className="person"><MiniAvatar name={name} size={size} />{name}</span>;
}

export function useAvatar(name: string): string | null {
  return useContext(AvatarContext)[name] ?? null;
}
