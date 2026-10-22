import { Cloud, Envelope, Heart, Star, Wash } from './Doodles';
import { COPY } from './copy';
import { usePendingUploads } from '../camera/usePending';
import './diary.css';

/** 現像待ち */
export function WaitScreen({ shotLimit, eventName }: { shotLimit: number; eventName: string }) {
  const pending = usePendingUploads();
  return (
    <div className="diary"><div className="dpage screen">
      <Wash color="blue" style={{ left: '-10cqw', top: '20cqw', width: '80cqw', height: '70cqw' }} />
      <Wash color="pink" style={{ right: '-12cqw', bottom: '-8cqw', width: '70cqw', height: '60cqw' }} />
      <Cloud className="flow bob" />
      <h1 className="dtitle">{COPY.waitTitle(shotLimit)}</h1>
      <p>{COPY.waitBody}</p>
      <p className="note">{eventName}</p>
      {pending > 0 && <p className="note" style={{ fontSize: '3.6cqw' }} role="status">送信中 {pending} 枚（このまま閉じないでね）</p>}
      <Heart className="flow" style={{ width: '12cqw' }} />
      <p className="note" style={{ fontSize: '3.4cqw' }}>{COPY.waitNote}</p>
    </div></div>
  );
}

/** 「絵日記がとどきました」 */
export function AnnounceScreen({ eventName, guests, onOpen }: { eventName: string; guests?: number; onOpen: () => void }) {
  return (
    <div className="diary"><div className="dpage screen">
      <Wash color="blue" style={{ left: '10cqw', top: '20cqw', width: '80cqw', height: '60cqw' }} />
      <Envelope className="flow bob" style={{ width: '44cqw' }} />
      <h1 className="dtitle">{COPY.announceTitle[0]}<br />{COPY.announceTitle[1]}</h1>
      <p className="note">{eventName}{guests ? ` ・ ${guests}人ぶん` : ''}</p>
      <Star className="flow" style={{ width: '10cqw' }} />
      <button type="button" className="hbtn2" onClick={onOpen}>{COPY.open}</button>
    </div></div>
  );
}
