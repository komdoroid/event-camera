import { useId, type CSSProperties } from 'react';

/**
 * 水彩・ポスターカラーで塗ったような筆のかたまり。親を position: relative にして、
 * 中身より先に置くと背景になる。色は CSS の色（var(--h-yellow) など）。
 * className="brush-in" を付けると、左から右へ筆でなぞるように現れる。
 */
export function Brush({ color, sweep = true, style }: { color: string; sweep?: boolean; style?: CSSProperties }) {
  const f = 'brush' + useId().replace(/:/g, '');
  return (
    <svg className={'brush' + (sweep ? ' brush-in' : '')} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" style={style}>
      <defs>
        <filter id={f} x="-15%" y="-40%" width="130%" height="180%">
          {/* 縁をがさがさにゆがめる（横に長い揺れ → かすれた筆の縁） */}
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.6" numOctaves="3" seed="7" result="n1" />
          <feDisplacementMap in="SourceGraphic" in2="n1" scale="9" xChannelSelector="R" yChannelSelector="G" result="d" />
          {/* 内側の濃淡（絵の具のムラ） */}
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.25" numOctaves="2" seed="3" result="n2" />
          <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.2 0 0 0 0.35" result="m" />
          <feComposite in="d" in2="m" operator="in" result="p" />
          <feGaussianBlur in="p" stdDeviation="0.5 0.35" />
        </filter>
      </defs>
      <g filter={`url(#${f})`}>
        <path d="M7 15 C10 8 22 6 40 7 C62 5 84 7 93 12 C97 17 95 27 91 31 C78 35 50 34 30 34 C18 35 9 32 6 27 C4 23 5 19 7 15Z" fill={color} />
        {/* 横にながれる筆あと */}
        <path d="M10 14 H88 M8 20 H93 M11 26 H85 M14 31 H80" stroke="#fff" strokeOpacity=".4" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <path d="M12 17 H70 M18 23 H90 M9 29 H62" stroke="#3d3c48" strokeOpacity=".07" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
