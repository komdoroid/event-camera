import type { EventStatus } from '../api';

/** ready: まだ1枚も撮られていない / shooting: 撮影中 / developed: 現像済み */
export type Stage = 'ready' | 'shooting' | 'developed';

export function hostStage(ev: { status: EventStatus; stats: { photos: number } }): Stage {
  if (ev.status === 'published') return 'developed';
  return ev.stats.photos > 0 ? 'shooting' : 'ready';
}

/** ゲストに知らせる定型文（URLは別に渡す） */
export const notifyText = (name: string) => `「${name}」の絵日記がとどきました。QRを読んだのと同じページから見られます`;

/** マイイベントの並び: 撮影中を上に。それぞれの中は元の順（新しい順）のまま */
export function shootingFirst<T>(items: T[], isShooting: (x: T) => boolean): T[] {
  return [...items.filter(isShooting), ...items.filter((x) => !isShooting(x))];
}
