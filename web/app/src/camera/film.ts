/** フィルムの状態（残り枚数と巻き上げ）。UI から独立した純粋関数 */
export const WIND_NEED = 170; // 巻き上げ完了に必要な横スワイプ量(px)

export interface Film { remaining: number; wound: boolean; progress: number }

export const startFilm = (remaining: number): Film => ({ remaining, wound: true, progress: 0 });

/** 撮影。撮れない状態なら null */
export function shoot(f: Film): Film | null {
  if (!f.wound || f.remaining <= 0) return null;
  return { remaining: f.remaining - 1, wound: false, progress: 0 };
}

/** 巻き上げ。dx は横スワイプ量 */
export function wind(f: Film, dx: number): Film {
  if (f.wound || f.remaining <= 0) return f;
  const progress = f.progress + Math.abs(dx);
  return { ...f, progress, wound: progress >= WIND_NEED };
}

/** 撮影が保存されなかったとき（現像済みだった等）に、1枚ぶん元に戻す */
export function refund(f: Film): Film {
  return { remaining: f.remaining + 1, wound: true, progress: 0 };
}
