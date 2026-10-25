import { describe, expect, it } from 'vitest';
import { KINDS, eventNameOrExample, kindMeta } from './kinds';

describe('kinds', () => {
  it('7種類そろっていて、名前の例がある', () => {
    expect(KINDS.map((k) => k.kind)).toEqual(['birthday', 'party', 'reunion', 'trip', 'company', 'wedding', 'other']);
    for (const k of KINDS) { expect(k.label).toBeTruthy(); expect(k.example).toBeTruthy(); }
  });
  it('知らない種類は「そのほか」になる', () => {
    expect(kindMeta('xyz').kind).toBe('other');
    expect(kindMeta(null).label).toBe('そのほか');
  });
  it('名前が空なら例の名前になる', () => {
    expect(eventNameOrExample('  ', 'birthday')).toBe('誕生日パーティー');
    expect(eventNameOrExample('  ', 'other')).toBe('みんなのイベント');
    expect(eventNameOrExample(' 花の会 ', 'trip')).toBe('花の会');
  });
});
