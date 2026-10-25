import type { Album } from '../api/types';

export type AlbumPageData = Album['pages'][number];

/** 写真のないページは除く。最後に「おわりのページ」が1枚つく */
export function visiblePages(pages: AlbumPageData[]): AlbumPageData[] {
  return pages.filter((p) => p.photos.length > 0);
}
export const totalPages = (pages: AlbumPageData[]) => visiblePages(pages).length + 1;
export const clampPage = (i: number, total: number) => Math.max(0, Math.min(total - 1, i));
export const countMine = (pages: AlbumPageData[]) => pages.reduce((n, p) => n + p.photos.filter((x) => x.mine).length, 0);
/** 印刷版のページ数: 表紙 + 中身 + 裏表紙、を偶数に切り上げる */
export function printPageCount(pages: AlbumPageData[]): number {
  const inner = visiblePages(pages).filter((p) => p.layout !== 'cover').length;
  const n = inner + 2;
  return n % 2 ? n + 1 : n;
}
/** 横スワイプの向き。縦スクロールとまぎらわしいものは null。+1 = つぎ、-1 = まえ */
export function swipeDir(dx: number, dy: number, min = 50): 1 | -1 | null {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 1 : -1;
}

const key = (eventId: string) => `ec.purchased.${eventId}`;
/** この端末で買ったもの（digital / print）。localStorage が使えなければ空 */
export function loadPurchased(eventId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(eventId)) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x === 'digital' || x === 'print') : [];
  } catch { return []; }
}
export function savePurchased(eventId: string, product: string) {
  try {
    const cur = loadPurchased(eventId);
    if (!cur.includes(product)) localStorage.setItem(key(eventId), JSON.stringify([...cur, product]));
  } catch { /* 保存できなくても購入画面は進む */ }
}
