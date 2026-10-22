import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, type EventInfo, type HostPhoto } from '../api';
import { adminLink, buildZip, guestUrl, loadHostToken, saveBlob, saveHostToken, takeTokenFromHash, withToken } from './hostLib';
import './host.css';

export default function HostEvent() {
  const { eventId = '' } = useParams();
  const [token, setToken] = useState(() => takeTokenFromHash(eventId) ?? loadHostToken(eventId));
  const [input, setInput] = useState('');
  const [ev, setEv] = useState<EventInfo | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [photos, setPhotos] = useState<HostPhoto[]>([]);
  const [qr, setQr] = useState('');
  const [fullQr, setFullQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
  const url = guestUrl(eventId);

  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 640 }).then(setQr).catch(() => {}); }, [url]);

  // 撮影状況を数秒おきに取得
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = () => api.getEvent(eventId).then((e) => { if (alive) { setEv(e); setLoadErr(false); } }).catch(() => alive && setLoadErr(true));
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [eventId, token]);

  // 一覧は stats.uploaded が変わったときに取り直す。古い API(uploaded なし)では数秒おきに取り直す
  const uploaded = ev?.stats.uploaded;
  const loaded = !!ev;
  useEffect(() => {
    if (!token || !loaded) return;
    let alive = true;
    const load = () => api.listPhotos(eventId, token).then((r) => alive && setPhotos(r.photos)).catch(() => {});
    load();
    if (uploaded !== undefined) return () => { alive = false; };
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [eventId, token, loaded, uploaded, ev?.status]);

  if (!token)
    return (
      <div className="host"><div className="host-in">
        <h1>この端末にはホストの権限がありません</h1>
        <p>イベントを作成した端末で開いてください。ホストトークンをお持ちなら、下に入力できます。</p>
        <label>ホストトークン<input value={input} onChange={(e) => setInput(e.target.value)} /></label>
        <button className="hbtn" disabled={!input.trim()} onClick={() => { saveHostToken(eventId, input.trim()); setToken(input.trim()); }}>設定する</button>
      </div></div>
    );

  async function publish() {
    setBusy(true); setErr('');
    try {
      await api.publish(eventId, token!);
      setConfirm(false);
      setEv(await api.getEvent(eventId));
    } catch { setErr('現像に失敗しました。もう一度お試しください。'); }
    setBusy(false);
  }
  async function download() {
    setErr(''); setZip({ done: 0, total: photos.length });
    try {
      const data = await buildZip(photos.map((p) => withToken(p.url, token!)), (done, total) => setZip({ done, total }));
      saveBlob(data, `${ev?.name ?? 'photos'}.zip`);
    } catch { setErr('ダウンロードに失敗しました。もう一度お試しください。'); }
    setZip(null);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr('コピーできませんでした。URLを長押ししてコピーしてください。'); }
  }

  async function copyAdmin() {
    try { await navigator.clipboard.writeText(adminLink(eventId, token!)); setCopiedAdmin(true); setTimeout(() => setCopiedAdmin(false), 2000); } catch { setErr('コピーできませんでした。'); }
  }
  const published = ev?.status === 'published';
  return (
    <div className="host"><div className="host-in">
      <h1>{ev?.name ?? '読み込み中…'}</h1>
      {loadErr && <div className="err" role="alert">状況を取得できません。通信を確認してください。</div>}

      <section className="card">
        <h2>ゲスト用QRコード</h2>
        <p>会場に掲示し、ゲストにスマホで読み取ってもらいます。</p>
        {qr && <img className="qr" src={qr} alt="ゲスト用QRコード" />}
        <div className="urlbox">{url}</div>
        <div className="hrow">
          <button className="hbtn ghost" onClick={copy}>{copied ? 'コピーしました' : 'URLをコピー'}</button>
          <button className="hbtn ghost" onClick={() => setFullQr(true)}>全画面で表示</button>
        </div>
      </section>

      <section className="card">
        <h2>撮影の状況</h2>
        <div className="stats">
          <div><b>{ev?.stats.guests ?? '-'}</b><span>参加ゲスト</span></div>
          <div><b>{ev?.stats.photos ?? '-'}</b><span>撮影枚数</span></div>
        </div>
        {ev?.stats.uploaded !== undefined && <p>撮影 {ev.stats.photos} 枚（うち保存済み {ev.stats.uploaded} 枚）{ev.stats.uploaded < ev.stats.photos ? ' 送信中の写真があります' : ''}</p>}
        {published ? (
          <>
            <p>現像済みです。アルバムを確認できます。</p>
            <Link className="hbtn" to={`/e/${eventId}/album`}>アルバムを見る</Link>
          </>
        ) : (
          <>
            <p>現像すると、全員の写真がアルバムになり、ゲストも見られるようになります。現像後は撮影できません。</p>
            <button className="hbtn" onClick={() => setConfirm(true)} disabled={!ev}>現像する</button>
          </>
        )}
      </section>

      <section className="card">
        <h2>写真一覧（{photos.length}枚）</h2>
        {photos.length === 0 ? <p>まだ写真がありません。</p> : (
          <div className="thumbs">
            {photos.map((p) => <img key={p.id} src={withToken(p.url, token)} alt="" loading="lazy" />)}
          </div>
        )}
        {zip && <><div className="bar"><i style={{ width: `${zip.total ? (zip.done / zip.total) * 100 : 0}%` }} /></div><p>{zip.done} / {zip.total} 枚を取得中…</p></>}
        <button className="hbtn ghost" onClick={download} disabled={photos.length === 0 || !!zip}>すべてダウンロード（zip）</button>
      </section>
      <section className="card">
        <h2>別の端末で管理する</h2>
        <p>このリンクを開いた端末でも、現像や写真のダウンロードができます。ホストの鍵が入っているので、ゲストや他の人には送らないでください。</p>
        <button className="hbtn ghost" onClick={copyAdmin}>{copiedAdmin ? 'コピーしました' : '管理用リンクをコピー'}</button>
      </section>
      {err && <div className="err" role="alert">{err}</div>}

      {confirm && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="現像の確認">
          <div className="dialog">
            <h2>現像しますか？</h2>
            <p>現在 {ev?.stats.photos ?? 0} 枚。現像すると、ゲストはこれ以上撮影できなくなり、元に戻せません。</p>
            <div className="hrow">
              <button className="hbtn ghost" onClick={() => setConfirm(false)} disabled={busy}>やめる</button>
              <button className="hbtn" onClick={publish} disabled={busy}>{busy ? '現像中…' : '現像する'}</button>
            </div>
          </div>
        </div>
      )}
      {fullQr && (
        <div className="overlay full" onClick={() => setFullQr(false)}>
          <div className="fullqr">
            <h1>{ev?.name}</h1>
            <img src={qr} alt="ゲスト用QRコード" />
            <p>スマホで読み取って撮影をはじめましょう（タップで閉じる）</p>
          </div>
        </div>
      )}
    </div></div>
  );
}
