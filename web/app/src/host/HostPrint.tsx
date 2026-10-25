import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, type EventInfo } from '../api';
import { KindIcon } from '../lib/KindIcon';
import { guestUrl } from './hostLib';
import './host.css';

/** A4 に A6 のカードを4枚。画面ではプレビュー、印刷ではカードだけを出す */
export default function HostPrint() {
  const { eventId = '' } = useParams();
  const [ev, setEv] = useState<EventInfo | null>(null);
  const [qr, setQr] = useState('');
  const [err, setErr] = useState(false);
  useEffect(() => { api.getEvent(eventId).then(setEv).catch(() => setErr(true)); }, [eventId]);
  useEffect(() => { QRCode.toDataURL(guestUrl(eventId), { margin: 1, width: 640 }).then(setQr).catch(() => {}); }, [eventId]);

  return (
    <div className="hprint">
      <div className="hprint-bar noprint">
        <Link className="hbtn" to={`/host/${eventId}`}>もどる</Link>
        <button type="button" className="hbtn ghost" disabled={!ev || !qr} onClick={() => window.print()}>印刷する</button>
      </div>
      <p className="notice noprint">A4の紙に4枚のカードが並びます。切りとって、テーブルや入口に置いてください。</p>
      {err && <p className="err noprint" role="alert">読み込めませんでした。通信を確認して、もどってもう一度開いてください。</p>}
      {ev && (
        <div className="pcards">
          {[0, 1, 2, 3].map((n) => (
            <div className="pcard" key={n}>
              <KindIcon kind={ev.kind} size={36} />
              <h1>{ev.name}</h1>
              {ev.message && <p className="pnote">{ev.message}</p>}
              {qr && <img src={qr} alt="ゲスト用QRコード" />}
              <ol>
                <li>QRを読む</li>
                <li>撮る（{ev.shotLimit}枚まで）</li>
                <li>絵日記がとどく</li>
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
