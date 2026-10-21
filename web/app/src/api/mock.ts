import { ApiError, type Api, type EventInfo } from './types';

/**
 * メモリ上のモック API（VITE_USE_MOCK_API=1）。リロードで消える。
 * URL に ?limit=3 を付けると枚数上限、?status=published で現像済みを試せる。
 */
const events = new Map<string, EventInfo & { hostToken: string; photos: { id: string; guestId: string; takenAt: string; blob?: Blob }[] }>();
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

function ensure(id: string) {
  let e = events.get(id);
  if (!e) {
    const q = new URLSearchParams(location.search);
    e = {
      id, name: 'Kazuki & Misaki Wedding', shotLimit: Number(q.get('limit')) || 27,
      status: q.get('status') === 'published' ? 'published' : 'shooting',
      publishedAt: q.get('status') === 'published' ? new Date().toISOString() : null,
      stats: { guests: 0, photos: 0 }, hostToken: 'mock-token', photos: [],
    };
    events.set(id, e);
  }
  return e;
}
const pub = (e: ReturnType<typeof ensure>): EventInfo => ({
  id: e.id, name: e.name, shotLimit: e.shotLimit, status: e.status, publishedAt: e.publishedAt,
  stats: { guests: new Set(e.photos.map((p) => p.guestId)).size, photos: e.photos.length },
});

export const mockApi: Api = {
  async createEvent({ name, shotLimit }) {
    await wait();
    const id = uid();
    const e = ensure(id);
    e.name = name; e.shotLimit = shotLimit ?? 27;
    // ホスト画面の確認用ダミー写真
    const hues = [10, 50, 120, 190, 250, 310];
    e.photos = hues.map((h, i) => ({
      id: uid(), guestId: `dummy-${i % 2}`, takenAt: new Date().toISOString(),
      blob: new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="hsl(${h} 60% 70%)"/><text x="200" y="230" font-size="120" text-anchor="middle" fill="#fff">${i + 1}</text></svg>`], { type: 'image/svg+xml' }),
    }));
    return { id, hostToken: e.hostToken, name, shotLimit: e.shotLimit };
  },
  async getEvent(id) { await wait(); return pub(ensure(id)); },
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
  async getAlbum(id) {
    await wait();
    const e = ensure(id);
    if (e.status !== 'published') throw new ApiError(403);
    const photos = e.photos.filter((p) => p.blob).map((p) => ({ id: p.id, url: URL.createObjectURL(p.blob!), takenAt: p.takenAt }));
    return { event: pub(e), stats: pub(e).stats, pages: photos.length ? [{ layout: 'grid', photos }] : [] };
  },
  async listPhotos(id) {
    await wait();
    const e = ensure(id);
    return { photos: e.photos.filter((p) => p.blob).map((p) => ({ id: p.id, url: URL.createObjectURL(p.blob!), takenAt: p.takenAt, guestId: p.guestId })) };
  },
  async createOrder(_id, _g, product) {
    await wait();
    return { orderId: uid(), product, amount: product === 'digital' ? 500 : 3000, status: 'paid_mock' };
  },
};
