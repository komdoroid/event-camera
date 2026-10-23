import { api } from '../api';
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

/** 空白・改行（%0A, %20 などのエンコード済みも含む）を全て消し、%23 を # に戻す */
export function cleanInput(s: string): string {
  return s.replace(/%(?:0[9-d]|20|c2%a0|e3%80%80)/gi, '').replace(/[\s\u00a0\u3000]+/g, '').replace(/%23/gi, '#');
}

export type ParsedLink =
  | { kind: 'import'; items: ImportItem[] }
  | { kind: 'token'; id: string; t: string }
  | { kind: 'invalid' };

/** 貼り付けられた文字列（取り込みリンク / ペイロードのみ / 管理用リンク）を解釈する純関数 */
export function parseLinkInput(raw: string): ParsedLink {
  const s = cleanInput(raw);
  if (!s) return { kind: 'invalid' };
  const imp = s.match(/(?:^|[#?&])import=([^&#]*)/);
  if (imp) {
    const items = parseImportPayload(imp[1]);
    return items.length ? { kind: 'import', items } : { kind: 'invalid' };
  }
  const adm = s.match(/\/host\/([^/#?]+)\/?(?:\?[^#]*)?#(?:.*&)?t=([^&]+)/);
  if (adm) {
    try {
      const t = decodeURIComponent(adm[2]);
      if (t) return { kind: 'token', id: decodeURIComponent(adm[1]), t };
    } catch { /* fallthrough */ }
    return { kind: 'invalid' };
  }
  const items = /^[A-Za-z0-9_\-+/=]+$/.test(s) ? parseImportPayload(s) : [];
  return items.length ? { kind: 'import', items } : { kind: 'invalid' };
}

/** ホストトークンが有効か（ホスト認証が要る API で確認） */
export async function verifyHostToken(id: string, t: string): Promise<boolean> {
  try { await api.listPhotos(id, t); return true; } catch { return false; }
}

export interface AddResult { added: number; failed: number }

/** 貼り付けを解釈し、確認できたものだけ一覧に追加する */
export async function addFromLinkText(raw: string): Promise<AddResult | null> {
  const p = parseLinkInput(raw);
  if (p.kind === 'invalid') return null;
  const items = p.kind === 'import' ? p.items : [{ id: p.id, t: p.t, name: '', createdAt: '' }];
  const oks = await Promise.all(items.map((e) => verifyHostToken(e.id, e.t)));
  let added = 0;
  items.forEach((e, i) => {
    if (!oks[i]) return;
    saveHostToken(e.id, e.t);
    upsertMyEvent({ id: e.id, name: e.name, createdAt: e.createdAt || undefined });
    added++;
  });
  return { added, failed: items.length - added };
}

/** location.hash の #import=... を取り込み、ハッシュを消す。取り込んだ件数を返す */
export function importFromHash(): number {
  const h = new URLSearchParams(location.hash.replace(/^#/, '')).get('import');
  if (h === null) return 0;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* noop */ }
  const items = parseImportPayload(cleanInput(h));
  for (const e of items) {
    saveHostToken(e.id, e.t);
    upsertMyEvent({ id: e.id, name: e.name, createdAt: e.createdAt || undefined });
  }
  return items.length;
}
