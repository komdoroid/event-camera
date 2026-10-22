import { describe, expect, it } from 'vitest';
import { formatDay, formatDot, formatTime, pageKind, shortOrder, yen } from './format';

describe('diary format', () => {
  const iso = new Date(2026, 9, 25, 19, 42).toISOString();
  it('日付・時刻の整形', () => {
    expect(formatDay(iso)).toBe('10月25日(日)');
    expect(formatTime(iso)).toBe('19:42');
    expect(formatDot(iso)).toBe('2026.10.25');
    expect(formatDay('invalid')).toBe('');
  });
  it('金額と注文番号', () => {
    expect(yen(3000)).toBe('¥3,000');
    expect(shortOrder('ab12cd34-ef56')).toBe('AB12CD');
  });
  it('ページ種別の分岐', () => {
    expect(pageKind('cover', 1)).toBe('cover');
    expect(pageKind('duo', 2)).toBe('duo');
    expect(pageKind('weird', 1)).toBe('full');
    expect(pageKind('weird', 2)).toBe('duo');
    expect(pageKind('weird', 4)).toBe('grid');
  });
});
