import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, type EventInfo, type HostPhoto } from '../api';
import Phrase from '../lib/Phrase';
import { Envelope } from '../diary/Doodles';
import { KindIcon } from '../lib/KindIcon';
import { themeStyle } from '../lib/kinds';
import { hostStage, notifyText, type Stage } from './stage';
import { upsertMyEvent } from './myEvents';
import { adminLink, buildZip, guestUrl, loadHostToken, parseHashToken, saveBlob, saveHostToken, withToken } from './hostLib';
import { verifyHostToken } from './hostImport';
import './host.css';

export default function HostEvent() {
  const { eventId = '' } = useParams();
  // ハッシュの #t= は、listPhotos で確認できるまで保存しない（保存済みのトークンは消さない）
  const [pending] = useState(() => parseHashToken(location.hash));
  const [token, setToken] = useState(() => loadHostToken(eventId));
  useEffect(() => {
    if (!pending) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* noop */ }
    verifyHostToken(eventId, pending).then((ok) => {
      if (!ok) return;
      saveHostToken(eventId, pending);
      upsertMyEvent({ id: eventId });
      setToken(pending);
    });
  }, [eventId, pending]);
  const [input, setInput] = useState('');
  const [ev, setEv] = useState<EventInfo | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [photos, setPhotos] = useState<HostPhoto[]>([]);
  const [qr, setQr] = useState('');
  const [fullQr, setFullQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [notified, setNotified] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
  const url = guestUrl(eventId);
  const published = ev?.status === 'published';

  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 640 }).then(setQr).catch(() => {}); }, [url]);

  // 撮影状況を数秒おきに取得
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = () => api.getEvent(eventId, token).then((e) => { if (alive) { setEv(e); setLoadErr(false); if (loadHostToken(eventId)) upsertMyEvent({ id: eventId, name: e.name }); } }).catch(() => alive && setLoadErr(true));
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
        <button className="hbtn ghost" disabled={!input.trim()} onClick={() => { saveHostToken(eventId, input.trim()); setToken(input.trim()); }}>設定する</button>
      </div></div>
    );

  async function publish() {
    setBusy(true); setErr('');
    try {
      await api.publish(eventId, token!);
      setConfirm(false);
      setEv(await api.getEvent(eventId, token!));
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
  async function notify() {
    if (!ev) return;
    const text = notifyText(ev.name);
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: ev.name, text, url });
      else throw new Error('no share');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 共有シートを閉じただけ
      try { await navigator.clipboard.writeText(`${text}\n${url}`); setNotified(true); setTimeout(() => setNotified(false), 3000); } catch { setErr('共有できませんでした。URLをコピーして送ってください。'); }
    }
  }

  const stage: Stage = ev ? hostStage(ev) : 'ready'; // 取得できない間も QR は出す
  const qrButtons = (primary: boolean) => (
    <div className="hrow">
      <Link className={'hbtn' + (primary ? ' ghost' : '')} to={`/host/${eventId}/print`}>QRカードを印刷</Link>
      <button type="button" className="hbtn" onClick={() => setFullQr(true)}>全画面で表示</button>
      <button type="button" className="hbtn" onClick={copy}>{copied ? 'コピーしました' : 'URLをコピー'}</button>
    </div>
  );
  return (
    <div className="host" style={themeStyle(ev?.kind)}><div className="host-in">
      <h1 className="evtitle">{ev && <KindIcon kind={ev.kind} size={34} />}<span>{ev ? <Phrase text={ev.name} /> : '読み込み中…'}</span></h1>
      {loadErr && <div className="err" role="alert">状況を取得できません。通信を確認してください。</div>}

      {stage === 'ready' && (
        <section className="card stage">
          <span className="chip">準備中</span>
          <h2>QRを配りましょう</h2>
          <p>ゲストにスマホで読み取ってもらいます。会場に貼る、テーブルに置く、画面を見せる、のどれでもOKです。</p>
          {qr && <img className="qr" src={qr} alt="ゲスト用QRコード" />}
          {qrButtons(true)}
          <Link className="hbtn shoot" to={`/e/${eventId}`}>わたしも撮る</Link>
        </section>
      )}

      {stage === 'shooting' && ev && (
        <section className="card stage">
          <span className="chip shooting">撮影中</span>
          <h2>みんなが撮っています</h2>
          <div className="stats">
            <div><b>{ev.stats.photos}</b><span>撮影枚数</span></div>
            <div><b>{ev.stats.guests}</b><span>参加ゲスト</span></div>
          </div>
          {ev.stats.uploaded !== undefined && ev.stats.uploaded < ev.stats.photos && <p>送信中の写真があります（保存済み {ev.stats.uploaded} 枚）</p>}
          <p>現像すると全員の写真が絵日記になり、ゲストにとどきます。現像後は撮影できません。</p>
          <button type="button" className="hbtn ghost" onClick={() => setConfirm(true)}>現像する</button>
          <Link className="hbtn shoot" to={`/e/${eventId}`}>わたしも撮る</Link>
        </section>
      )}

      {stage === 'developed' && ev && (
        <section className="card stage">
          <span className="chip published">現像済み</span>
          <Envelope className="flow donehero" />
          <h2>絵日記ができました</h2>
          <p>ゲストに知らせましょう。QRを読んだのと同じページから、絵日記が見られます。</p>
          <button type="button" className="hbtn ghost" onClick={notify}>{notified ? '文面をコピーしました' : 'ゲストに知らせる'}</button>
          <Link className="hbtn shoot" to={`/e/${eventId}/album`}>アルバムを見る</Link>
        </section>
      )}

      {stage && stage !== 'ready' && (
        <section className="card">
          <h2>ゲスト用QRコード</h2>
          {stage === 'shooting' && <p>まだ配っていないゲストがいたら、もう一度見せられます。</p>}
          {qr && <img className="qr" src={qr} alt="ゲスト用QRコード" />}
          <div className="urlbox">{url}</div>
          {qrButtons(false)}
        </section>
      )}

      <section className="card">
        <h2>写真一覧（{photos.length}枚）</h2>
        {photos.length === 0 ? <p>まだ写真がありません。</p> : (
          <div className="thumbs">
            {photos.map((p) => <img key={p.id} src={withToken(p.url, token)} alt="" loading="lazy" />)}
          </div>
        )}
        {zip && <><div className="bar"><i style={{ width: `${zip.total ? (zip.done / zip.total) * 100 : 0}%` }} /></div><p>{zip.done} / {zip.total} 枚を取得中…</p></>}
        <button className="hbtn" onClick={download} disabled={photos.length === 0 || !!zip}>すべてダウンロード（zip）</button>
      </section>
      <section className="card">
        <h2>別の端末で管理する</h2>
        <p>このリンクを開いた端末でも、現像や写真のダウンロードができます。ホストの鍵が入っているので、ゲストや他の人には送らないでください。</p>
        <button className="hbtn" onClick={copyAdmin}>{copiedAdmin ? 'コピーしました' : '管理用リンクをコピー'}</button>
      </section>
      {err && <div className="err" role="alert">{err}</div>}

      {confirm && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="現像の確認">
          <div className="dialog">
            <h2>現像しますか？</h2>
            <p>現在 {ev?.stats.photos ?? 0} 枚。現像すると、ゲストはこれ以上撮影できなくなり、元に戻せません。</p>
            <div className="hrow">
              <button className="hbtn" onClick={() => setConfirm(false)} disabled={busy}>やめる</button>
              <button className="hbtn ghost" onClick={publish} disabled={busy}>{busy ? '現像中…' : '現像する'}</button>
            </div>
          </div>
        </div>
      )}
      {fullQr && (
        <div className="overlay full" onClick={() => setFullQr(false)}>
          <div className="fullqr">
            <h1>{ev && <Phrase text={ev.name} />}</h1>
            <img src={qr} alt="ゲスト用QRコード" />
            <p>スマホで読み取って撮影をはじめましょう（タップで閉じる）</p>
          </div>
        </div>
      )}
    </div></div>
  );
}
