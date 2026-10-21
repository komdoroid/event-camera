import { describe, expect, it, vi } from 'vitest';
import { shoot, startFilm, wind, WIND_NEED } from './film';
import { uploadShot } from './uploader';
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
  it('0枚なら撮れない', () => {
    expect(shoot(startFilm(0))).toBeNull();
  });
});

describe('uploadShot', () => {
  const mk = (over: Partial<Api> = {}) => {
    const calls: string[] = [];
    const api = {
      createShot: vi.fn(async () => { calls.push('post'); return { photoId: 'p', uploadUrl: 'u', expiresAt: '', remaining: 1 }; }),
      uploadPhoto: vi.fn(async () => { calls.push('put'); }),
      ...over,
    } as unknown as Api;
    return { api, calls };
  };
  const job = { eventId: 'e', guestId: 'g', blob: new Blob(['x']) };
  it('POST → PUT の順', async () => {
    const { api, calls } = mk();
    await uploadShot(job, api, async () => {});
    expect(calls).toEqual(['post', 'put']);
  });
  it('失敗は数回やり直す', async () => {
    let n = 0;
    const { api } = mk({ uploadPhoto: vi.fn(async () => { if (++n < 3) throw new Error('net'); }) } as Partial<Api>);
    await uploadShot(job, api, async () => {});
    expect(n).toBe(3);
  });
  it('409 はやり直さず投げる', async () => {
    const { api } = mk({ createShot: vi.fn(async () => { throw new ApiError(409); }) } as Partial<Api>);
    await expect(uploadShot(job, api, async () => {})).rejects.toBeInstanceOf(ApiError);
    expect(api.createShot).toHaveBeenCalledTimes(1);
  });
});
