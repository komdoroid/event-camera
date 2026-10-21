import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type EventInfo } from '../api';
import { getGuestId } from '../lib/guestId';
import CameraScreen from '../camera/CameraScreen';

type Load =
  | { s: 'loading' }
  | { s: 'error' }
  | { s: 'ready'; event: EventInfo; remaining: number };

export default function GuestPage() {
  const { eventId = '' } = useParams();
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [finished, setFinished] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoad({ s: 'loading' });
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

  const { event, remaining } = load;
  // 現像済み: アルバムへの入口（本体は T4）
  if (event.status === 'published')
    return (
      <div className="plain">
        <h1>{event.name}</h1>
        <p>アルバムができました。</p>
        <Link className="btn" to={`/e/${eventId}/album`}>アルバムを見る</Link>
      </div>
    );
  // 撮り切り: 現像待ち（見た目は T4 で作り直す）
  if (finished || remaining <= 0)
    return (
      <div className="plain">
        <h1>撮り終えました</h1>
        <p>{event.name}<br />現像されるまで、写真は見られません。ホストが現像したあと、同じURLを開いてください。</p>
      </div>
    );

  return <CameraScreen event={event} guestId={getGuestId()} initialRemaining={remaining} onFinished={() => setFinished(true)} />;
}
