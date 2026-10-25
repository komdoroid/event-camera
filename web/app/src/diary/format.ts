const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n: number) => String(n).padStart(2, '0');

/** 「10月25日(日)」 */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日(${DOW[d.getDay()]})`;
}
/** 「19:42」 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** 「2026.10.25」 */
export function formatDot(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
export const yen = (n: number) => '¥' + n.toLocaleString('en-US');
/** 注文番号の短い形 */
export const shortOrder = (id: string) => id.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

export type PageKind = 'cover' | 'full' | 'duo' | 'grid';
/** API の layout 文字列を描画の種類に。未知の値は枚数で決める */
export function pageKind(layout: string, count: number): PageKind {
  if (layout === 'cover' || layout === 'full' || layout === 'duo' || layout === 'grid') return layout;
  return count <= 1 ? 'full' : count === 2 ? 'duo' : 'grid';
}

/**
 * 長い題名を1行に近づけるための文字サイズ(cqw)。baseは通常のサイズ。
 * 8字まではそのまま、9〜12字は1行に収まる大きさ、13字以上はそれより小さくしない(2行まで)。
 */
export function titleSize(name: string, base: number): number {
  const n = [...name].length;
  if (n <= 8) return base;
  const fit = n <= 12 ? 86 / n : 7.2;
  return Math.round(Math.min(base, fit) * 10) / 10;
}
