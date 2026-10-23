import { saveHostToken } from './hostLib';
import { upsertMyEvent } from './myEvents';

export interface ImportItem { id: string; t: string; name: string; createdAt: string }

/** base64url(UTF-8 の JSON 配列) を読む。不正なら空配列 */
export function parseImportPayload(payload: string): ImportItem[] {
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v
      .filter((e) => e && typeof e.id === 'string' && e.id && typeof e.t === 'string' && e.t)
      .map((e) => ({ id: e.id, t: e.t, name: typeof e.name === 'string' ? e.name : '', createdAt: typeof e.createdAt === 'string' ? e.createdAt : '' }));
  } catch { return []; }
}

/** location.hash の #import=... を取り込み、ハッシュを消す。取り込んだ件数を返す */
export function importFromHash(): number {
  const h = new URLSearchParams(location.hash.replace(/^#/, '')).get('import');
  if (h === null) return 0;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* noop */ }
  const items = parseImportPayload(h);
  for (const e of items) {
    saveHostToken(e.id, e.t);
    upsertMyEvent({ id: e.id, name: e.name, createdAt: e.createdAt || undefined });
  }
  return items.length;
}
