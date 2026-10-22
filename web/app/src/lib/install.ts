/** 「ホーム画面に追加」の案内を出すかどうかの判定 */
export type Platform = 'ios' | 'android' | 'other';
const KEY = 'ec.installDismissed';

export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

export function isDismissed(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function dismissInstall() {
  try { localStorage.setItem(KEY, '1'); } catch { /* noop */ }
}

/** 'prompt': 「追加する」ボタン / 'ios': 手順の案内 / null: 出さない */
export function installHint(o: { standalone: boolean; dismissed: boolean; platform: Platform; canPrompt: boolean }): 'prompt' | 'ios' | null {
  if (o.standalone || o.dismissed) return null;
  if (o.canPrompt) return 'prompt';
  if (o.platform === 'ios') return 'ios';
  return null;
}
