import type { CSSProperties } from 'react';
import type { EventKind } from '../api/types';

const S = { fill: 'none', stroke: 'var(--h-ink, #3d3c48)', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const PINK = 'var(--h-pink, #f6c0ba)';
const BLUE = 'var(--h-blue, #a6d4e4)';
const YELLOW = 'var(--h-yellow, #ffd96a)';
const MINT = 'var(--h-mint, #9fe0c4)';
const ORANGE = 'var(--h-orange, #ffb27a)';
const PURPLE = 'var(--h-purple, #c7b3f0)';

const art: Record<EventKind, React.ReactNode> = {
  // ケーキ
  birthday: (
    <>
      <rect x="8" y="26" width="32" height="14" rx="3" fill="#fff" />
      <path d="M8 31 Q14 36 20 31 T32 31 T40 31" fill={PINK} />
      <path d="M24 26 V18 M24 18 C21 15 24 11 24 11 C24 11 27 15 24 18Z" fill={YELLOW} />
      <path d="M13 26 V21 M35 26 V21" />
    </>
  ),
  // かんぱい（グラス2つ）
  party: (
    <>
      <path d="M8 10 H22 L21 20 C20.6 24 9.4 24 9 20Z" fill={YELLOW} />
      <path d="M15 24 V38 M10 38 H20" />
      <path d="M28 12 H42 L41 22 C40.6 26 29.4 26 29 22Z" fill={ORANGE} />
      <path d="M35 26 V38 M30 38 H40" />
      <path d="M24 4 V7 M18 5 L19.5 7.5 M30 5 L28.5 7.5" />
    </>
  ),
  // 学帽
  reunion: (
    <>
      <path d="M24 10 L44 20 L24 30 L4 20Z" fill={MINT} />
      <path d="M12 26 V34 C18 40 30 40 36 34 V26" fill="#fff" />
      <path d="M42 22 V32" />
      <circle cx="42" cy="34" r="2" fill={YELLOW} />
    </>
  ),
  // スーツケース
  trip: (
    <>
      <rect x="6" y="14" width="36" height="25" rx="4" fill={BLUE} />
      <path d="M17 14 V9 H31 V14" />
      <path d="M17 14 V39 M31 14 V39" />
      <path d="M12 43 H14 M34 43 H36" />
      <circle cx="24" cy="26" r="3" fill={YELLOW} />
    </>
  ),
  // ビル
  company: (
    <>
      <rect x="9" y="8" width="20" height="33" rx="2" fill="#fff" />
      <rect x="29" y="20" width="11" height="21" rx="2" fill={PURPLE} />
      <path d="M14 15 H17 M21 15 H24 M14 22 H17 M21 22 H24 M14 29 H17 M21 29 H24" />
      <path d="M33 27 H36 M33 34 H36" />
      <path d="M5 41 H44" />
    </>
  ),
  // 指輪
  wedding: (
    <>
      <circle cx="24" cy="30" r="12" fill="#fff" />
      <circle cx="24" cy="30" r="7" />
      <path d="M18 12 L24 6 L30 12 L24 19Z" fill={PINK} />
      <path d="M18 12 H30" />
    </>
  ),
  // 星
  other: <path d="M24 5 L29.5 18 L43 19.5 L33 29 L36 42 L24 35 L12 42 L15 29 L5 19.5 L18.5 18Z" fill={YELLOW} />,
};

/** イベントの種類を表す手描き風アイコン（48x48）。揺れ線フィルター #wob を使う */
export function KindIcon({ kind, size = 40, style, className }: { kind: EventKind; size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" style={{ filter: 'url(#wob)', flex: 'none', ...style }} {...S}>
      {art[kind] ?? art.other}
    </svg>
  );
}
