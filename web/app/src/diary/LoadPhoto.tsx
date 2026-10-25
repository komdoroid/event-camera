import { useState } from 'react';
import { Tape } from './Doodles';
import { COPY } from './copy';

/** 手描きの枠に入れた写真。読み込み中は枠だけ、失敗したら枠の中に「もう一度」 */
export function LoadPhoto({ src, tilt = 0, ratio = '4 / 3', tape = false, mine = false, alt = '' }: { src: string; tilt?: number; ratio?: string; tape?: boolean; mine?: boolean; alt?: string }) {
  const [st, setSt] = useState<'loading' | 'ok' | 'error'>('loading');
  const [n, setN] = useState(0);
  return (
    <figure className="pframe" style={{ transform: `rotate(${tilt}deg)` }}>
      {tape && <Tape style={{ left: '38%', top: '-3cqw', transform: 'rotate(-5deg)' }} />}
      <div className={`pbox ${st}`} style={{ aspectRatio: ratio }}>
        {st !== 'error' && (
          <img key={n} src={src} alt={alt} decoding="async" onLoad={() => setSt('ok')} onError={() => setSt('error')} />
        )}
        {st === 'error' && (
          <div className="perr" role="alert">
            <span>{COPY.photoError}</span>
            <button type="button" className="hbtn2 small" onClick={() => { setSt('loading'); setN((x) => x + 1); }}>{COPY.retry}</button>
          </div>
        )}
      </div>
      {mine && <span className="sticker note">{COPY.mine}</span>}
    </figure>
  );
}
