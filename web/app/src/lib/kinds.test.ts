import { describe, expect, it } from 'vitest';
import { KINDS, eventNameOrExample, kindMeta, pageColorStyle, themeStyle } from './kinds';

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
  it('種類ごとにテーマ色があり、知らない種類は水色になる', () => {
    expect(kindMeta('birthday').color).toBe('yellow');
    expect(themeStyle('wedding')).toMatchObject({ '--theme': 'var(--h-pink)', '--theme-tint': 'var(--h-pink-t)' });
    expect(themeStyle('xyz')).toMatchObject({ '--theme': 'var(--h-blue)' });
  });
  it('アルバムのページ色は順番に回る', () => {
    expect(pageColorStyle(0)).not.toEqual(pageColorStyle(1));
    expect(pageColorStyle(6)).toEqual(pageColorStyle(0));
  });
});
