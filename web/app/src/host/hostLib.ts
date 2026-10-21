import { zipSync } from 'fflate';

const key = (eventId: string) => `ec.hostToken.${eventId}`;

export function saveHostToken(eventId: string, token: string) {
  try { localStorage.setItem(key(eventId), token); } catch { /* noop */ }
}
export function loadHostToken(eventId: string): string | null {
  try { return localStorage.getItem(key(eventId)); } catch { return null; }
}

/** <img> はヘッダを付けられないので、http(s) の写真URLには ?token= を付ける */
export function withToken(url: string, token: string): string {
  if (!/^https?:/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
}

export const guestUrl = (eventId: string) => `${location.origin}/e/${eventId}`;

const extOf = (type: string) => (type.includes('png') ? 'png' : type.includes('svg') ? 'svg' : 'jpg');

/** 写真を1枚ずつ順に取得して zip にする（JPEGは圧縮済みなので無圧縮で格納） */
export async function buildZip(
  urls: string[],
  onProgress: (done: number, total: number) => void,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  onProgress(0, urls.length);
  for (let i = 0; i < urls.length; i++) {
    const res = await fetchFn(urls[i]);
    if (!res.ok) throw new Error(`photo ${i + 1}: ${res.status}`);
    const blob = await res.blob();
    files[`photo-${String(i + 1).padStart(3, '0')}.${extOf(blob.type)}`] = new Uint8Array(await blob.arrayBuffer());
    onProgress(i + 1, urls.length);
    await new Promise((r) => setTimeout(r)); // UI を固めない
  }
  return zipSync(files, { level: 0 });
}

export function saveBlob(data: Uint8Array, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type: 'application/zip' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
