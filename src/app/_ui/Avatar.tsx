// 프로필 사진이 있으면 사진, 없으면 이름 끝 두 글자
type Props = { name: string; src: string | null; size?: number; className?: string };

export function Avatar({ name, src, size = 28, className }: Props) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.43) };
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className={`avatar ${className ?? ''}`} src={src} alt={`${name} 프로필 사진`} style={style} />
    : <span className={`avatar ${className ?? ''}`} style={style} aria-hidden="true">{name.slice(-2)}</span>;
}
