export type Platform = 'ios' | 'android' | 'other';
/** User-Agent から、カメラ許可の戻し方を分ける */
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios'; // iPadOS はデスクトップ表記
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
