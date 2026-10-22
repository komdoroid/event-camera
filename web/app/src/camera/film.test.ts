import { describe, expect, it, vi } from 'vitest';
import { refund, shoot, startFilm, wind, WIND_NEED } from './film';
import { UploadQueue } from './uploader';
import { ApiError, type Api } from '../api';

describe('film', () => {
  it('1枚目は巻き上げ済みで撮れる。撮ると巻き上げるまで撮れない', () => {
    let f = startFilm(2);
    f = shoot(f)!;
    expect(f.remaining).toBe(1);
    expect(shoot(f)).toBeNull();
    f = wind(f, WIND_NEED - 1);
    expect(f.wound).toBe(false);
    f = wind(f, -2); // 逆方向のスワイプも量として数える
    expect(f.wound).toBe(true);
    expect(shoot(f)!.remaining).toBe(0);
  });
  it('保存されなかった撮影は元に戻せる', () => {
    const f = refund(shoot(startFilm(3))!);
    expect(f.remaining).toBe(3);
    expect(f.wound).toBe(true);
  });
  it('0枚なら撮れない', () => {
    expect(shoot(startFilm(0))).toBeNull();
  });
});

describe('UploadQueue', () => {
  const job = { eventId: 'e', guestId: 'g', blob: new Blob(['x']) };
  const future = () => new Date(Date.now() + 600000).toISOString();
  const ticket = { photoId: 'p', uploadUrl: 'u', expiresAt: future(), remaining: 1 };
  const idle = (q: UploadQueue) => new Promise<void>((r) => { const t = setInterval(() => { if (q.pending === 0) { clearInterval(t); r(); } }, 2); });

  it('POST → PUT の順で送る', async () => {
    const calls: string[] = [];
    const api = { createShot: async () => { calls.push('post'); return ticket; }, uploadPhoto: async () => { calls.push('put'); } } as unknown as Api;
    const q = new UploadQueue(api, { delays: [1] });
    q.enqueue(job, () => {});
    await idle(q);
    expect(calls).toEqual(['post', 'put']);
  });
  it('PUT の失敗は blob を残して再試行し、成功する（POST は1回だけ）', async () => {
    let n = 0, posts = 0;
    const api = { createShot: async () => { posts++; return ticket; }, uploadPhoto: async () => { if (++n < 3) throw new Error('net'); } } as unknown as Api;
    const q = new UploadQueue(api, { delays: [1] });
    q.enqueue(job, () => { throw new Error('should not fail'); });
    expect(q.pending).toBe(1);
    await idle(q);
    expect(n).toBe(3);
    expect(posts).toBe(1);
  });
  it('POST の通信エラーも再試行する', async () => {
    let n = 0;
    const api = { createShot: async () => { if (++n < 2) throw new Error('net'); return ticket; }, uploadPhoto: async () => {} } as unknown as Api;
    const q = new UploadQueue(api, { delays: [1] });
    q.enqueue(job, () => {});
    await idle(q);
    expect(n).toBe(2);
  });
  it('POST が 403 なら closed、409 なら limit を通知して捨てる', async () => {
    for (const [status, reason] of [[403, 'closed'], [409, 'limit']] as const) {
      const api = { createShot: async () => { throw new ApiError(status); }, uploadPhoto: async () => {} } as unknown as Api;
      const q = new UploadQueue(api, { delays: [1] });
      const got: string[] = [];
      q.enqueue(job, (r) => got.push(r));
      await idle(q);
      expect(got).toEqual([reason]);
    }
  });
  it('署名URLの期限が切れたら expired を通知する', async () => {
    let t = Date.now();
    const api = { createShot: async () => ({ ...ticket, expiresAt: new Date(t + 5000).toISOString() }), uploadPhoto: async () => { t += 10000; throw new Error('net'); } } as unknown as Api;
    const q = new UploadQueue(api, { delays: [1], now: () => (t += 1) });
    const got: string[] = [];
    q.enqueue(job, (r) => got.push(r));
    await idle(q);
    expect(got).toEqual(['expired']);
  });
});
