// 화면(클라이언트)에서도 쓰는 설정 타입과 기본값. DB 코드를 가져오지 않는다.
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
  /** 프로필 사진(작게 줄인 이미지의 data URL), 없으면 null */
  avatar: string | null;
};

export const DEFAULT_PREFS: Prefs = {
  themeH: 232, themeS: 55, themeL: 76, themeHex: null, weekStart: 'mon', doingHex: null, doneHex: null, avatar: null,
};
