import type { CSSProperties } from 'react';
import type { EventKind } from '../api/types';

export type ThemeColor = 'blue' | 'pink' | 'yellow' | 'mint' | 'orange' | 'purple';

export interface KindMeta {
  kind: EventKind;
  /** タイルなどに出す種類の名前 */
  label: string;
  /** イベント名の例。名前が空のときの既定の名前にもなる */
  example: string;
  /** テーマ色（タイル・表紙・管理画面・ゲスト画面・アルバムの色） */
  color: ThemeColor;
}

/** 表示順。アイコンは lib/KindIcon.tsx の <KindIcon kind=... /> */
export const KINDS: KindMeta[] = [
  { kind: 'birthday', label: '誕生日', example: '誕生日パーティー', color: 'yellow' },
  { kind: 'party', label: '飲み会・パーティー', example: '飲み会', color: 'orange' },
  { kind: 'reunion', label: '同窓会', example: '同窓会', color: 'mint' },
  { kind: 'trip', label: '旅行', example: '旅行', color: 'blue' },
  { kind: 'company', label: '社内イベント', example: '社内イベント', color: 'purple' },
  { kind: 'wedding', label: '結婚式', example: 'ウェディングパーティー', color: 'pink' },
  { kind: 'other', label: 'そのほか', example: 'みんなのイベント', color: 'blue' },
];

export const DEFAULT_KIND: EventKind = 'other';

export function kindMeta(kind: EventKind | string | null | undefined): KindMeta {
  return KINDS.find((k) => k.kind === kind) ?? KINDS[KINDS.length - 1];
}

/** 名前が空なら種類の例の名前を使う */
export function eventNameOrExample(name: string, kind: EventKind): string {
  return name.trim() || kindMeta(kind).example;
}

/** 種類のテーマ色を CSS の --theme / --theme-tint に渡す。画面のルートの style に付ける */
export function themeStyle(kind: EventKind | string | null | undefined): CSSProperties {
  const c = kindMeta(kind).color;
  return { '--theme': `var(--h-${c})`, '--theme-tint': `var(--h-${c}-t)` } as CSSProperties;
}

/** アルバムのページごとに順番に回す色 */
export const PAGE_COLORS: ThemeColor[] = ['yellow', 'mint', 'pink', 'blue', 'orange', 'purple'];
export function pageColorStyle(index: number): CSSProperties {
  const c = PAGE_COLORS[index % PAGE_COLORS.length];
  const d = PAGE_COLORS[(index + 3) % PAGE_COLORS.length];
  return { '--pc': `var(--h-${c})`, '--pc-t': `var(--h-${c}-t)`, '--pc2': `var(--h-${d})` } as CSSProperties;
}

/** アルバムの表紙: テーマ色に、シールなどの差し色（ピンク。テーマがピンクなら黄色）を足す */
export function coverStyle(kind: EventKind | string | null | undefined): CSSProperties {
  const accent = kindMeta(kind).color === 'pink' ? 'yellow' : 'pink';
  return { ...themeStyle(kind), '--pc': 'var(--theme)', '--pc-t': 'var(--theme-tint)', '--pc2': `var(--h-${accent})` } as CSSProperties;
}
