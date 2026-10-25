import type { CSSProperties, ReactNode } from 'react';

/** 揺れ線フィルター。アプリのルートで1回だけ置く */
export function WobDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="wob" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="t" />
        <feDisplacementMap in="SourceGraphic" in2="t" scale="5" />
      </filter>
    </svg>
  );
}

const stroke = { fill: 'none', stroke: 'var(--h-ink)', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

interface DProps { style?: CSSProperties; className?: string }
const D = ({ vb, style, className = '', children }: DProps & { vb: string; children: ReactNode }) => (
  <svg className={`doodle wob ${className}`} viewBox={vb} style={style} aria-hidden="true" {...stroke}>{children}</svg>
);

export const Heart = (p: DProps) => <D vb="0 0 60 60" {...p}><path d="M30 52 C6 34 6 12 20 12 C26 12 30 18 30 18 C30 18 34 12 40 12 C54 12 54 34 30 52Z" fill="var(--df, var(--h-pink))" /></D>;
export const Star = (p: DProps) => <D vb="0 0 60 60" {...p}><path d="M30 6 L37 22 L54 24 L41 36 L45 54 L30 45 L15 54 L19 36 L6 24 L23 22Z" fill="var(--df, var(--h-yellow))" /></D>;
export const Sun = (p: DProps) => <D vb="0 0 40 40" {...p}><circle cx="20" cy="20" r="8" fill="var(--h-orange)" /><path d="M20 3 V8 M20 32 V37 M3 20 H8 M32 20 H37 M8 8 L11 11 M29 29 L32 32 M32 8 L29 11 M8 32 L11 29" /></D>;
export const Arrow = (p: DProps) => <D vb="0 0 60 40" {...p}><path d="M6 30 C20 6 36 6 50 22 M42 12 L52 23 L38 26" /></D>;
export const Cloud = (p: DProps) => <D vb="0 0 80 60" {...p}><circle cx="26" cy="34" r="16" /><circle cx="48" cy="30" r="16" /><path d="M26 14 L22 6 L30 8 Z" fill="var(--h-purple)" /></D>;
export const Envelope = (p: DProps) => (
  <D vb="0 0 100 70" {...p}>
    <rect x="6" y="10" width="88" height="54" rx="3" fill="#fff" /><path d="M6 12 L50 42 L94 12" />
    <path d="M50 4 C44 -2 36 6 50 16 C64 6 56 -2 50 4Z" fill="var(--h-orange)" />
  </D>
);
export const Phone = (p: DProps) => <D vb="0 0 60 100" {...p}><rect x="8" y="4" width="44" height="90" rx="9" fill="var(--h-mint)" /><rect x="14" y="14" width="32" height="60" fill="#fff" /><circle cx="30" cy="84" r="4" fill="var(--h-yellow)" /></D>;
export const Book = (p: DProps) => (
  <D vb="0 0 70 100" {...p}>
    <rect x="14" y="10" width="48" height="82" fill="#fff" /><rect x="8" y="6" width="48" height="82" fill="var(--h-purple)" />
    <rect x="16" y="16" width="32" height="28" fill="#fff" /><path d="M18 58 H46 M18 68 H38" />
  </D>
);

/** 手書きの波線・点・星で作ったお祝いの落書き（終わりのページ・購入など） */
export const Confetti = ({ style, className = '' }: DProps) => (
  <svg className={`doodle wob ${className}`} viewBox="0 0 120 60" style={style} aria-hidden="true" {...stroke}>
    <path d="M8 14 Q16 4 24 14 T40 14" stroke="var(--h-orange)" strokeWidth={3.5} />
    <path d="M70 46 Q78 36 86 46 T102 46" stroke="var(--h-purple)" strokeWidth={3.5} />
    <circle cx="58" cy="12" r="4" fill="var(--h-mint)" /><circle cx="108" cy="16" r="4" fill="var(--h-pink)" />
    <circle cx="14" cy="46" r="4" fill="var(--h-yellow)" /><circle cx="46" cy="40" r="3" fill="var(--h-blue)" />
    <path d="M92 8 L96 18 M30 34 L38 38" stroke="var(--h-blue)" strokeWidth={3} />
  </svg>
);
export const Squiggle = ({ style }: { style?: CSSProperties }) => (
  <svg className="squig wob" viewBox="0 0 120 10" preserveAspectRatio="none" style={style} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M3 5 Q12 0 21 5 T39 5 T57 5 T75 5 T93 5 T117 5" /></svg>
);

export const Tape = ({ style }: { style?: CSSProperties }) => <i className="tape wob" style={style} aria-hidden="true" />;
/** にじんだ色。color に 'theme' を渡すとイベントのテーマ色（無ければ水色） */
export const Wash = ({ color, style }: { color: 'blue' | 'pink' | 'yellow' | 'mint' | 'orange' | 'purple' | 'theme' | 'page'; style?: CSSProperties }) => {
  const c = color === 'theme' ? 'var(--theme, var(--h-blue))' : color === 'page' ? 'var(--pc, var(--h-yellow))' : `var(--h-${color})`;
  return <i className="wash" style={{ background: `radial-gradient(circle, ${c}, transparent 70%)`, ...style }} aria-hidden="true" />;
};

/** 揺れ枠に入れた写真 */
export function Photo({ src, tilt = 0, ratio = '4 / 3', tape = false, alt = '' }: { src: string; tilt?: number; ratio?: string; tape?: boolean; alt?: string }) {
  return (
    <figure className="pframe" style={{ transform: `rotate(${tilt}deg)` }}>
      {tape && <Tape style={{ left: '38%', top: '-3cqw', transform: 'rotate(-5deg)' }} />}
      <img src={src} alt={alt} loading="lazy" decoding="async" style={{ aspectRatio: ratio }} />
    </figure>
  );
}
