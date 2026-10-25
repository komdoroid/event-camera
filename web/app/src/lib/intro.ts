const KEY = 'ec.introSeen';
export function isIntroSeen(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; }
}
export function markIntroSeen() {
  try { localStorage.setItem(KEY, '1'); } catch { /* noop */ }
}
