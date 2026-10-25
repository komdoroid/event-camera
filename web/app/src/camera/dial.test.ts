import { describe, expect, it } from 'vitest';
import { dialPhase, RIDGE_PERIOD } from './dial';

describe('dialPhase', () => {
  it('0 のときは 0', () => expect(dialPhase(0)).toBe(0));
  it('指の移動量にそのまま追従する', () => expect(dialPhase(4)).toBe(4));
  it('1周すると元に戻る', () => expect(dialPhase(RIDGE_PERIOD * 3 + 2)).toBeCloseTo(2));
  it('逆方向(負)でも 0..period に収まる', () => {
    const p = dialPhase(-2);
    expect(p).toBeCloseTo(RIDGE_PERIOD - 2);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(RIDGE_PERIOD);
  });
});

import { dialRidges, DIAL_R } from './dial';
describe('dialRidges', () => {
  it('中央は間隔が広く、端は詰まる', () => {
    const r = dialRidges(0.03).sort((a, b) => a.x - b.x);
    const mid = r.findIndex((v) => v.x > 0);
    const gapMid = r[mid].x - r[mid - 1].x;
    const gapEdge = r[1].x - r[0].x;
    expect(gapMid).toBeGreaterThan(gapEdge * 2);
  });
  it('位相を進めると中央付近のうねが +R*phase だけ動く(1:1)', () => {
    const near = (p: number) => dialRidges(p).map((v) => v.x).reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
    expect(near(0.02) - near(0.0)).toBeCloseTo(DIAL_R * 0.02, 0);
  });
});
