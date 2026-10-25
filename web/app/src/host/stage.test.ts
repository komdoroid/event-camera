import { describe, expect, it } from 'vitest';
import { hostStage, notifyText, shootingFirst } from './stage';

describe('hostStage', () => {
  it('段階を決める', () => {
    expect(hostStage({ status: 'shooting', stats: { photos: 0 } })).toBe('ready');
    expect(hostStage({ status: 'shooting', stats: { photos: 3 } })).toBe('shooting');
    expect(hostStage({ status: 'published', stats: { photos: 0 } })).toBe('developed');
  });
  it('知らせる文に名前が入る', () => {
    expect(notifyText('同窓会')).toBe('「同窓会」の絵日記がとどきました。QRを読んだのと同じページから見られます');
  });
  it('撮影中を上に、順番は保つ', () => {
    expect(shootingFirst([1, 2, 3, 4], (x) => x % 2 === 0)).toEqual([2, 4, 1, 3]);
  });
});
