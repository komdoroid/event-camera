/** 巻き上げダイヤルの模様の位置(px)。指の累積移動量 wx を 0..period に畳む */
export const RIDGE_PERIOD = 9;

export function dialPhase(wx: number, period = RIDGE_PERIOD): number {
  return ((wx % period) + period) % period;
}

/** 円筒の半径(px)と、うねの角度間隔(rad)。中央での間隔は R*STEP ≒ 9px */
export const DIAL_R = 75;
export const RIDGE_STEP = 0.12;

export interface Ridge { x: number; w: number; c: number }

/** 位相 phase(rad) での各うねの横位置 x = R*sin(θ+phase) と、遠近の太さ係数 c = cos(…)（端ほど小さい） */
export function dialRidges(phase: number, R = DIAL_R, step = RIDGE_STEP): Ridge[] {
  const base = ((phase % step) + step) % step;
  const out: Ridge[] = [];
  for (let t = -Math.PI / 2 + base; t < Math.PI / 2; t += step) {
    const c = Math.cos(t);
    if (c > 0.02) out.push({ x: R * Math.sin(t), w: c, c });
  }
  return out;
}
