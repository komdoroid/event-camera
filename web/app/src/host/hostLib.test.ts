import { beforeEach, describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { buildZip, loadHostToken, saveHostToken, withToken } from './hostLib';

describe('hostLib', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  });
  it('hostToken はイベントIDごとに保存される', () => {
    saveHostToken('a', 'ta'); saveHostToken('b', 'tb');
    expect(loadHostToken('a')).toBe('ta');
    expect(loadHostToken('c')).toBeNull();
  });
  it('withToken は http(s) にだけ ?token= / &token= を付ける', () => {
    expect(withToken('https://x/api/photos/1', 't')).toBe('https://x/api/photos/1?token=t');
    expect(withToken('https://x/p?a=1', 't')).toBe('https://x/p?a=1&token=t');
    expect(withToken('blob:abc', 't')).toBe('blob:abc');
  });
  it('buildZip は順に取得し進捗を出して zip にする', async () => {
    const order: string[] = [];
    const f = (async (u: string) => { order.push(u); return new Response(new Blob([u], { type: 'image/jpeg' })); }) as unknown as typeof fetch;
    const prog: number[] = [];
    const zip = await buildZip(['u1', 'u2'], (d) => prog.push(d), f);
    expect(order).toEqual(['u1', 'u2']);
    expect(prog).toEqual([0, 1, 2]);
    expect(Object.keys(unzipSync(zip))).toEqual(['photo-001.jpg', 'photo-002.jpg']);
  });
});
