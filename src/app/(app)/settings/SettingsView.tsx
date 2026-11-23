'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { savePrefsAction } from '@/app/actions/prefs';
import { hexToHsl, hslToHex, parseHex, themeVars } from '@/lib/color';
import { DEFAULT_PREFS, type Prefs } from '@/lib/prefs-shared';

const PASTELS = ['A0A9E3', 'C4AEE6', '9ED9B0', 'F5B597', 'F4B6C2', 'B9C2CF', 'F3D98B', '9CD5E0'];
const STATUS_SWATCHES = ['F3D98B', 'F5B597', 'F4B6C2', 'C4AEE6', 'A0A9E3', '9CD5E0', '9ED9B0', 'B9C2CF', 'E8A33D', '4F9D69'];
const HEX_MSG = '색상 코드는 # 뒤에 6자리로 입력하세요. 예: A3B1F0';
const VAR_KEYS = ['--h', '--s', '--l', '--on-accent', '--on-done', '--dh', '--ds', '--dl', '--oh', '--os', '--ol'];
const WHEEL = 220;

/** 화면에 바로 적용(저장 전 미리 보기 포함) */
function paint(p: Prefs) {
  const root = document.documentElement;
  const vars = themeVars(p);
  for (const k of VAR_KEYS) {
    if (vars[k] !== undefined) root.style.setProperty(k, vars[k]);
    else root.style.removeProperty(k);
  }
}

export function SettingsView({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [status, setStatus] = useState<string>('바꾸면 바로 저장됩니다.');
  const [, start] = useTransition();
  const saved = useRef(initial);

  useEffect(() => { paint(prefs); }, [prefs]);

  const save = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setStatus('저장 중…');
    start(async () => {
      const res = await savePrefsAction(patch);
      if (res?.error) { setStatus(res.error); setPrefs(saved.current); return; }
      saved.current = next;
      setStatus('저장했습니다.');
    });
  };

  return (
    <div className="settings">
      <ThemePanel prefs={prefs} preview={(p) => setPrefs({ ...prefs, ...p })} save={save} />
      <section className="panel set-card" aria-labelledby="h-week">
        <h2 id="h-week">위클리 시작 요일</h2>
        <p className="help">위클리에서 한 주를 무슨 요일부터 보여 줄지 고릅니다.</p>
        <div className="choice">
          {(['sun', 'mon'] as const).map((s) => {
            const days = s === 'sun' ? ['일', '월', '화', '수', '목', '금', '토'] : ['월', '화', '수', '목', '금', '토', '일'];
            return (
              <button key={s} type="button" aria-pressed={prefs.weekStart === s} onClick={() => save({ weekStart: s })}>
                <b>{s === 'sun' ? '일요일 시작' : '월요일 시작'}</b>
                <span className="mini-week">{days.map((d) => <span key={d} className={d === '일' ? 'sun' : undefined}>{d}</span>)}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel set-card" aria-labelledby="h-status">
        <h2 id="h-status">진행 중 · 완료 색</h2>
        <p className="help">&lsquo;자동&rsquo;이면 테마 색에 어울리는 색이 저절로 정해집니다. &lsquo;직접 선택&rsquo;으로 바꾸면 원하는 색을 고를 수 있습니다.</p>
        <StatusPicker label="진행 중" kind="doing" value={prefs.doingHex} onSave={(hex) => save({ doingHex: hex })} />
        <StatusPicker label="완료" kind="done" value={prefs.doneHex} onSave={(hex) => save({ doneHex: hex })} />
        <div className="preview" aria-label="미리 보기">
          <span><i className="check" />미완료</span>
          <span><i className="check doing" /><span className="by doing">진행 중 · 이영희 09:14</span></span>
          <span><i className="check done" /><span className="by done">완료 · 박민수 08:55</span></span>
        </div>
      </section>
      <p className="muted set-status" role="status">{status}</p>
    </div>
  );
}

function ThemePanel({ prefs, preview, save }: {
  prefs: Prefs; preview: (p: Partial<Prefs>) => void; save: (p: Partial<Prefs>) => void;
}) {
  const wheel = useRef<HTMLDivElement>(null);
  const dragging = useRef<Partial<Prefs> | null>(null);
  const [hexInput, setHexInput] = useState<string | null>(null);
  const [hexErr, setHexErr] = useState<string | null>(null);
  const shownHex = prefs.themeHex ?? hslToHex(prefs.themeH, prefs.themeS, prefs.themeL);

  const fromPointer = (e: React.PointerEvent) => {
    const box = wheel.current!.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2, y = e.clientY - box.top - box.height / 2;
    const p = {
      themeH: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) % 360,
      themeS: Math.round(Math.min(100, (Math.hypot(x, y) / (box.width / 2)) * 100)),
      themeHex: null,
    };
    dragging.current = p;
    preview(p);
  };
  const r = WHEEL / 2, rad = (prefs.themeS / 100) * r, a = (prefs.themeH * Math.PI) / 180;

  const applyHex = (e: React.FormEvent) => {
    e.preventDefault();
    const hex = parseHex(hexInput ?? shownHex);
    if (!hex) { setHexErr(HEX_MSG); return; }
    setHexErr(null); setHexInput(null);
    const c = hexToHsl(hex), l = Math.min(90, Math.max(25, c.l));
    save({ themeH: c.h, themeS: c.s, themeL: l, themeHex: l === c.l ? hex : null });
  };

  return (
    <section className="panel set-card set-theme" aria-labelledby="h-theme">
      <h2 id="h-theme">테마 색</h2>
      <p className="help">원을 눌러 색을 고르고 밝기를 맞추세요. 색상 코드를 직접 넣어도 됩니다. 배경과 글자색까지 함께 바뀌고, 내 계정에만 적용됩니다.</p>
      <div className="theme-grid">
        <div
          ref={wheel} className="wheel" role="slider" tabIndex={0} aria-label="테마 색"
          aria-valuetext={`#${shownHex}`} aria-valuenow={prefs.themeH} aria-valuemin={0} aria-valuemax={359}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e); }}
          onPointerUp={() => { if (dragging.current) { save(dragging.current); dragging.current = null; } }}
          onKeyDown={(e) => {
            const m: Record<string, Partial<Prefs>> = {
              ArrowRight: { themeH: (prefs.themeH + 6) % 360 }, ArrowLeft: { themeH: (prefs.themeH + 354) % 360 },
              ArrowUp: { themeS: Math.min(100, prefs.themeS + 5) }, ArrowDown: { themeS: Math.max(0, prefs.themeS - 5) },
            };
            if (m[e.key]) { e.preventDefault(); save({ ...m[e.key], themeHex: null }); }
          }}
        >
          <span className="knob" style={{ left: r + rad * Math.cos(a), top: r + rad * Math.sin(a), background: `hsl(${prefs.themeH} ${prefs.themeS}% ${prefs.themeL}%)` }} />
        </div>
        <div className="theme-side">
          <label className="tone">밝기 <span>진하게</span>
            <input type="range" min={25} max={90} value={prefs.themeL}
              onChange={(e) => preview({ themeL: Number(e.target.value), themeHex: null })}
              onPointerUp={(e) => save({ themeL: Number((e.target as HTMLInputElement).value), themeHex: null })}
              onKeyUp={(e) => save({ themeL: Number((e.target as HTMLInputElement).value), themeHex: null })}
              aria-label="밝기" />
            <span>연하게</span>
          </label>
          <form className="hex" onSubmit={applyHex}>
            <label htmlFor="theme-hex">색상 코드</label><span className="hash">#</span>
            <input id="theme-hex" maxLength={7} spellCheck={false} autoComplete="off"
              value={hexInput ?? shownHex} onChange={(e) => setHexInput(e.target.value)} />
            <button type="submit">적용</button>
          </form>
          {hexErr && <p className="err">{hexErr}</p>}
          <div className="quick" aria-label="추천 색">
            {PASTELS.map((hex) => (
              <button key={hex} type="button" aria-label={`#${hex}`} aria-pressed={shownHex === hex} style={{ background: `#${hex}` }}
                onClick={() => { const c = hexToHsl(hex); setHexInput(null); save({ themeH: c.h, themeS: c.s, themeL: c.l, themeHex: hex }); }} />
            ))}
          </div>
          <button type="button" className="reset" onClick={() => { setHexInput(null); save({ themeH: DEFAULT_PREFS.themeH, themeS: DEFAULT_PREFS.themeS, themeL: DEFAULT_PREFS.themeL, themeHex: null }); }}>
            기본 색으로
          </button>
        </div>
      </div>
    </section>
  );
}

function StatusPicker({ label, kind, value, onSave }: {
  label: string; kind: 'doing' | 'done'; value: string | null; onSave: (hex: string | null) => void;
}) {
  const [manual, setManual] = useState(value !== null);
  const [input, setInput] = useState(value ?? '');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setInput(value ?? ''); }, [value]);
  return (
    <div className="status-set">
      <div className="status-head">
        <i className={`check ${kind}`} /><h3>{label}</h3>
        <div className="seg">
          <button type="button" aria-pressed={!manual} onClick={() => { setManual(false); onSave(null); }}>자동</button>
          <button type="button" aria-pressed={manual} onClick={() => { setManual(true); if (!value) onSave(kind === 'doing' ? 'F3D98B' : '9ED9B0'); }}>직접 선택</button>
        </div>
      </div>
      {manual && (
        <div className="status-body">
          <div className="quick">
            {STATUS_SWATCHES.map((hex) => (
              <button key={hex} type="button" aria-label={`${label} #${hex}`} aria-pressed={value === hex} style={{ background: `#${hex}` }} onClick={() => onSave(hex)} />
            ))}
          </div>
          <form className="hex" onSubmit={(e) => {
            e.preventDefault();
            const hex = parseHex(input);
            if (!hex) { setErr(HEX_MSG); return; }
            setErr(null); onSave(hex);
          }}>
            <span className="hash">#</span>
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={7} spellCheck={false} autoComplete="off" aria-label={`${label} 색상 코드`} />
            <button type="submit">적용</button>
          </form>
          {err && <p className="err">{err}</p>}
        </div>
      )}
    </div>
  );
}
