import { describe, expect, it } from 'vitest';
import { formatDay, formatDot, formatTime, pageKind, shortOrder, titleSize, yen } from './format';

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

describe('titleSize', () => {
  it('8字まではそのまま', () => {
    expect(titleSize('結婚式', 13)).toBe(13);
    expect(titleSize('あいうえおかきく', 9)).toBe(9);
  });
  it('9〜12字は1行に収まる大きさまで小さくする', () => {
    expect(titleSize('ウェディングパーティー', 13)).toBe(7.8);
    expect(titleSize('あいうえおかきくけ', 13)).toBeCloseTo(9.6, 1);
    expect(titleSize('あいうえおかきくけこさし', 13)).toBe(7.2);
  });
  it('13字以上は7.2で据え置き。baseより大きくならない', () => {
    expect(titleSize('あ'.repeat(13), 13)).toBe(7.2);
    expect(titleSize('あ'.repeat(40), 13)).toBe(7.2);
    expect(titleSize('あ'.repeat(9), 9)).toBe(9);
  });
});
