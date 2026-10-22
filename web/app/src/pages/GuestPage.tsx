import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type EventInfo } from '../api';
import { getGuestId } from '../lib/guestId';
import CameraScreen from '../camera/CameraScreen';
import { AnnounceScreen, WaitScreen } from '../diary/Screens';

type Load =
  | { s: 'loading' }
  | { s: 'error' }
  | { s: 'ready'; event: EventInfo; remaining: number };

export default function GuestPage() {
  const { eventId = '' } = useParams();
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [finished, setFinished] = useState(false);
  const [tick, setTick] = useState(0);
  const [latest, setLatest] = useState<EventInfo | null>(null);
  const nav = useNavigate();
  const waiting = load.s === 'ready' && load.event.status !== 'published' && (finished || load.remaining <= 0);

  // 現像待ちの間は数秒おきに状態を見る
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { api.getEvent(eventId).then(setLatest).catch(() => {}); }, 5000);
    return () => clearInterval(t);
  }, [waiting, eventId]);

  useEffect(() => {
    let alive = true;
    setLoad({ s: 'loading' });
    setLatest(null);
    Promise.all([api.getEvent(eventId), api.getGuest(eventId, getGuestId())])
      .then(([event, g]) => alive && setLoad({ s: 'ready', event, remaining: g.remaining }))
      .catch(() => alive && setLoad({ s: 'error' }));
    return () => { alive = false; };
  }, [eventId, tick]);

  if (load.s === 'loading') return <div className="plain"><p>読み込み中…</p></div>;
  if (load.s === 'error')
    return (
      <div className="plain">
        <h1>開けませんでした</h1>
        <p>イベントが見つからないか、通信に失敗しました。</p>
        <button className="btn" onClick={() => setTick((t) => t + 1)}>もう一度</button>
      </div>
    );

  const { remaining } = load;
  const event = latest ?? load.event;
  // 現像済み: 「絵日記がとどきました」
  if (event.status === 'published')
    return <AnnounceScreen eventName={event.name} guests={event.stats.guests} onOpen={() => nav(`/e/${eventId}/album`)} />;
  // 撮り切り: 現像待ち（現像されたら自動で切りかわる）
  if (finished || remaining <= 0) return <WaitScreen shotLimit={event.shotLimit} eventName={event.name} />;

  return <CameraScreen event={event} guestId={getGuestId()} initialRemaining={remaining} onFinished={() => setFinished(true)} />;
}
