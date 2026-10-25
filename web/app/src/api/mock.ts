import { ApiError, type Api, type EventInfo, type EventKind } from './types';

/**
 * メモリ上のモック API（VITE_USE_MOCK_API=1）。リロードで消える。
 * URL に ?limit=3 を付けると枚数上限、?status=published で現像済みを試せる。
 */
const events = new Map<string, EventInfo & { hostToken: string; salesCount: { digital: number; print: number }; photos: { id: string; guestId: string; takenAt: string; blob?: Blob }[] }>();
function seedPhotos(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: uid(), guestId: `dummy-${i % 3}`, takenAt: new Date(2026, 9, 25, 14, 20 + i * 7).toISOString(),
    blob: new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="hsl(${(i * 53 + 10) % 360} 60% 72%)"/><text x="240" y="230" font-size="140" text-anchor="middle" fill="#fff">${i + 1}</text></svg>`], { type: 'image/svg+xml' }),
  }));
}
function buildPages<T>(photos: T[]) {
  const pages: { layout: string; photos: T[] }[] = [];
  if (!photos.length) return pages;
  pages.push({ layout: 'cover', photos: [photos[0]] });
  const sizes = [2, 4, 1, 3];
  let i = 1, c = 0;
  while (i < photos.length) {
    let n = Math.min(sizes[c++ % sizes.length], photos.length - i);
    if (photos.length - i - n === 1 && n > 2) n -= 1;
    pages.push({ layout: n === 1 ? 'full' : n === 2 ? 'duo' : 'grid', photos: photos.slice(i, i + n) });
    i += n;
  }
  return pages;
}
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

function ensure(id: string) {
  let e = events.get(id);
  if (!e) {
    const q = new URLSearchParams(location.search);
    const kinds: EventKind[] = ['wedding', 'birthday', 'party', 'reunion', 'trip', 'company', 'other'];
    const kind = (kinds.find((k) => k === q.get('kind')) ?? kinds[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % kinds.length]);
    e = {
      id, name: 'ウェディングパーティー', kind, message: 'みんなの一枚を残そう', coverPhotoId: null, shotLimit: Number(q.get('limit')) || 27,
      status: q.get('status') === 'published' ? 'published' : 'shooting',
      publishedAt: q.get('status') === 'published' ? new Date().toISOString() : null,
      stats: { guests: 0, photos: 0 }, hostToken: 'mock-token', salesCount: { digital: 2, print: 1 }, photos: q.get('status') === 'published' ? seedPhotos(12) : [],
    };
    events.set(id, e);
  }
  return e;
}
const pub = (e: ReturnType<typeof ensure>, token?: string): EventInfo => ({
  id: e.id, name: e.name, kind: e.kind, message: e.message,
  coverPhotoId: e.status === 'published' || token === e.hostToken ? (e.photos.find((p) => p.blob)?.id ?? null) : null, shotLimit: e.shotLimit, status: e.status, publishedAt: e.publishedAt,
  stats: { guests: new Set(e.photos.map((p) => p.guestId)).size, photos: e.photos.length, uploaded: e.photos.filter((p) => p.blob).length },
  ...(token === e.hostToken ? { sales: { digital: e.salesCount.digital, print: e.salesCount.print, revenue: e.salesCount.digital * 500 + e.salesCount.print * 3000 } } : {}),
});

export const mockApi: Api = {
  async createEvent({ name, shotLimit, kind, message }) {
    await wait();
    const id = uid();
    const e = ensure(id);
    e.name = name; e.kind = kind ?? 'other'; e.message = message ?? null; e.shotLimit = shotLimit ?? 27;
    e.photos = seedPhotos(6); // ホスト画面の確認用ダミー写真
    return { id, hostToken: e.hostToken, name, shotLimit: e.shotLimit, kind: e.kind, message: e.message };
  },
  async getEvent(id, token) { await wait(); return pub(ensure(id), token); },
  async getGuest(id, guestId) {
    await wait();
    const e = ensure(id);
    const taken = e.photos.filter((p) => p.guestId === guestId).length;
    return { taken, remaining: Math.max(0, e.shotLimit - taken) };
  },
  async createShot(id, guestId) {
    await wait();
    const e = ensure(id);
    if (e.status === 'published') throw new ApiError(403);
    const taken = e.photos.filter((p) => p.guestId === guestId).length;
    if (taken >= e.shotLimit) throw new ApiError(409);
    const photoId = uid();
    e.photos.push({ id: photoId, guestId, takenAt: new Date().toISOString() });
    return { photoId, uploadUrl: `mock://upload/${id}/${photoId}`, expiresAt: new Date(Date.now() + 600000).toISOString(), remaining: e.shotLimit - taken - 1 };
  },
  async uploadPhoto(uploadUrl, blob) {
    await wait(300);
    const [eid, pid] = uploadUrl.replace('mock://upload/', '').split('/');
    const p = events.get(eid)?.photos.find((x) => x.id === pid);
    if (!p) throw new ApiError(403);
    p.blob = blob;
  },
  async publish(id) {
    await wait();
    const e = ensure(id);
    e.status = 'published'; e.publishedAt = new Date().toISOString();
    return { status: 'published', publishedAt: e.publishedAt };
  },
  async getAlbum(id, guestId) {
    await wait();
    const e = ensure(id);
    if (e.status !== 'published') throw new ApiError(403);
    const photos = e.photos.filter((p) => p.blob).map((p) => ({ id: p.id, url: URL.createObjectURL(p.blob!), takenAt: p.takenAt, mine: guestId ? p.guestId === guestId || p.guestId === 'dummy-0' : undefined }));
    return { event: pub(e), stats: pub(e).stats, pages: buildPages(photos) };
  },
  async listPhotos(id, token) {
    await wait();
    const e = ensure(id);
    if (token !== e.hostToken) throw new ApiError(401);
    return { photos: e.photos.filter((p) => p.blob).map((p) => ({ id: p.id, url: URL.createObjectURL(p.blob!), takenAt: p.takenAt, guestId: p.guestId })) };
  },
  async createOrder(_id, _g, product) {
    await wait();
    return { orderId: uid(), product, amount: product === 'digital' ? 500 : 3000, status: 'paid_mock' };
  },
};
