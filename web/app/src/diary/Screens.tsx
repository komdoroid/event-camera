import type { CSSProperties } from 'react';
import { Confetti, Envelope, Heart, Star, Wash } from './Doodles';
import { themeStyle } from '../lib/kinds';
import { copyFor } from './copy';
import type { EventKind } from '../api/types';
import { usePendingUploads } from '../camera/usePending';
import './diary.css';

/** 現像待ち */
export function WaitScreen({ shotLimit, eventName, kind }: { shotLimit: number; eventName: string; kind?: EventKind }) {
  const pending = usePendingUploads();
  const COPY = copyFor(kind);
  return (
    <div className="diary" style={themeStyle(kind)}><div className="dpage screen">
      <Wash color="theme" style={{ left: '-10cqw', top: '20cqw', width: '80cqw', height: '70cqw' }} />
      <Wash color="yellow" style={{ right: '-12cqw', bottom: '-8cqw', width: '70cqw', height: '60cqw' }} />
      <Confetti className="cf" style={{ left: '6cqw', top: '8cqw', width: '28cqw' }} />
      <Star className="flow bob" />
      <h1 className="dtitle">{COPY.waitTitle(shotLimit)}</h1>
      <p>{COPY.waitBody}</p>
      <p className="note">{eventName}</p>
      {pending > 0 && <p className="note" style={{ fontSize: '3.6cqw' }} role="status">送信中 {pending} 枚（このまま閉じないでね）</p>}
      <Heart className="flow" style={{ width: '12cqw', '--df': 'var(--h-orange)' } as CSSProperties} />
      <p className="note" style={{ fontSize: '3.4cqw' }}>{COPY.waitNote}</p>
      <div className="waithint">
        <p><b>{COPY.waitReturn}</b></p>
        <p className="note" style={{ fontSize: '3.6cqw' }}>{COPY.waitSave}<br />{COPY.waitQr}</p>
      </div>
    </div></div>
  );
}

/** 「絵日記がとどきました」 */
const COPY0 = copyFor();
export function AnnounceScreen({ eventName, guests, kind, onOpen }: { eventName: string; guests?: number; kind?: EventKind; onOpen: () => void }) {
  return (
    <div className="diary" style={themeStyle(kind)}><div className="dpage screen">
      <Wash color="theme" style={{ left: '10cqw', top: '20cqw', width: '80cqw', height: '60cqw' }} />
      <Wash color="pink" style={{ right: '-10cqw', bottom: '-6cqw', width: '60cqw', height: '50cqw' }} />
      <Confetti className="cf" style={{ right: '6cqw', top: '8cqw', width: '28cqw' }} />
      <Envelope className="flow bob" style={{ width: '44cqw' }} />
      <h1 className="dtitle">{COPY0.announceTitle[0]}<br />{COPY0.announceTitle[1]}</h1>
      <p className="note">{eventName}{guests ? ` ・ ${guests}人ぶん` : ''}</p>
      <Star className="flow" style={{ width: '10cqw' }} />
      <button type="button" className="hbtn2 pri" onClick={onOpen}>{COPY0.open}</button>
    </div></div>
  );
}
