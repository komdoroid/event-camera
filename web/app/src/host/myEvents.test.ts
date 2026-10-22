import { beforeEach, describe, expect, it } from 'vitest';
import { loadMyEvents, removeMyEvent, upsertMyEvent } from './myEvents';
import { detectPlatform, installHint } from '../lib/install';

beforeEach(() => {
  const m = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
});

describe('myEvents', () => {
  it('新しい順に並び、重複せず、名前は後から補える', () => {
    upsertMyEvent({ id: 'a', name: 'A', createdAt: '2026-10-01T00:00:00Z' });
    upsertMyEvent({ id: 'b', name: 'B', createdAt: '2026-10-02T00:00:00Z' });
    upsertMyEvent({ id: 'c', createdAt: '2026-10-03T00:00:00Z' });
    upsertMyEvent({ id: 'c', name: 'C' });
    upsertMyEvent({ id: 'a', name: '' });
    const l = loadMyEvents();
    expect(l.map((e) => e.id)).toEqual(['c', 'b', 'a']);
    expect(l[0].name).toBe('C');
    expect(l[2].name).toBe('A');
  });
  it('一覧から外せる。壊れた保存値でも空になる', () => {
    upsertMyEvent({ id: 'a', name: 'A' });
    removeMyEvent('a');
    expect(loadMyEvents()).toEqual([]);
    localStorage.setItem('ec.myEvents', '{oops');
    expect(loadMyEvents()).toEqual([]);
  });
});

describe('install hint', () => {
  const base = { standalone: false, dismissed: false, platform: 'other' as const, canPrompt: false };
  it('端末の判定', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14)')).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('other');
  });
  it('出す条件', () => {
    expect(installHint({ ...base, canPrompt: true, platform: 'android' })).toBe('prompt');
    expect(installHint({ ...base, platform: 'ios' })).toBe('ios');
    expect(installHint({ ...base, platform: 'android' })).toBeNull(); // プロンプト不可
    expect(installHint({ ...base, platform: 'ios', standalone: true })).toBeNull();
    expect(installHint({ ...base, platform: 'ios', dismissed: true })).toBeNull();
    expect(installHint({ ...base, canPrompt: true, dismissed: true })).toBeNull();
  });
});
