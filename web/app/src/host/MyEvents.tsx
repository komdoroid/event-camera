import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, photoUrl, type EventInfo } from '../api';
import { Cloud, Heart } from '../diary/Doodles';
import { formatDot } from '../diary/format';
import { detectPlatform, dismissInstall, installHint, isDismissed, isInstallShown, isStandalone, markInstallShown } from '../lib/install';
import { KindIcon } from '../lib/KindIcon';
import { loadHostToken } from './hostLib';
import { shootingFirst } from './stage';
import { SampleLinks } from './Intro';
import { loadMyEvents, removeMyEvent, upsertMyEvent, type MyEvent } from './myEvents';
import { addFromLinkText, importFromHash } from './hostImport';
import './host.css';

type BIPEvent = Event & { prompt: () => Promise<unknown> };

/** 最初のイベントを作ったあとに、1回だけ出す */
function InstallHint() {
  const [firstTime] = useState(() => !isInstallShown());
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(isDismissed);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  const kind = installHint({ standalone: isStandalone(), dismissed, platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints), canPrompt: !!deferred });
  useEffect(() => { if (kind && firstTime) markInstallShown(); }, [kind, firstTime]);
  if (!kind || !firstTime) return null;
  const close = () => { dismissInstall(); setDismissed(true); };
  return (
    <div className="install card">
      <h2>ホーム画面に追加</h2>
      <p>ホーム画面に追加すると、アプリのように使えます。</p>
      {kind === 'ios' && <p>Safari の「共有」ボタン → 「ホーム画面に追加」を選んでください。</p>}
      <div className="hrow">
        {kind === 'prompt' && <button type="button" className="hbtn ghost" onClick={async () => { await deferred!.prompt(); setDeferred(null); }}>追加する</button>}
        <button type="button" className="hbtn" onClick={close}>閉じる</button>
      </div>
    </div>
  );
}

function Cover({ info, token }: { info: EventInfo | null; token: string | null }) {
  const [bad, setBad] = useState(false);
  const id = info?.coverPhotoId;
  return (
    <div className="evcover" aria-hidden="true">
      {id && !bad ? <img src={photoUrl(id, info?.status === 'published' ? undefined : token ?? undefined)} alt="" loading="lazy" onError={() => setBad(true)} /> : <KindIcon kind={info?.kind ?? 'other'} size={36} />}
    </div>
  );
}

function EventCard({ ev, onRemove, onInfo }: { ev: MyEvent; onRemove: () => void; onInfo: (i: EventInfo) => void }) {
  const nav = useNavigate();
  const [info, setInfo] = useState<EventInfo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    api.getEvent(ev.id, loadHostToken(ev.id) ?? undefined)
      .then((e) => { if (alive) { setInfo(e); onInfo(e); if (e.name !== ev.name) upsertMyEvent({ id: ev.id, name: e.name }); } })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [ev.id, ev.name]);
  return (
    <li className="evcard">
      <button type="button" className="evmain" onClick={() => nav(`/host/${ev.id}`)}>
        <Cover info={info} token={loadHostToken(ev.id)} />
        <span className="evtext">
        <span className="evname2">{info?.name ?? (ev.name || '(名前を取得中)')}</span>
        <span className="evmeta">
          {ev.createdAt && <span>{formatDot(ev.createdAt)}</span>}
          {info && <span className={`chip ${info.status}`}>{info.status === 'published' ? '現像済み' : '撮影中'}</span>}
        </span>
        {info ? (
          <span className="evstats">ゲスト {info.stats.guests} 人 ・ {info.stats.photos} 枚{info.status === 'published' && info.sales ? ` ・ 売れた ${info.sales.digital + info.sales.print} 冊` : ''}</span>
        ) : failed ? (
          <span className="evstats small">状況を取得できません</span>
        ) : (
          <span className="skel" aria-label="読み込み中" />
        )}
        </span>
      </button>
      <button type="button" className="evdel" aria-label={`${ev.name || 'このイベント'}を一覧から外す`} onClick={onRemove}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
      </button>
    </li>
  );
}

function AddByLink({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit() {
    setBusy(true); setErr('');
    const r = await addFromLinkText(text);
    setBusy(false);
    if (!r) { setErr('リンクを読み取れませんでした。管理用リンクをそのまま貼り付けてください。'); return; }
    if (r.added === 0) { setErr('確認できませんでした。リンクが正しいか確かめてください。'); return; }
    onDone(`${r.added}件追加しました` + (r.failed ? `。${r.failed}件は確認できませんでした` : ''));
  }
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="リンクで追加">
      <div className="dialog">
        <h2>リンクで追加</h2>
        <p className="notice">管理用リンクか取り込み用リンクを貼り付けてください。途中で改行や空白が入っていても大丈夫です。</p>
        <textarea className="linkarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…/host/…#t=…" autoFocus />
        {err && <p className="err" role="alert">{err}</p>}
        <div className="hrow">
          <button type="button" className="hbtn" onClick={onClose} disabled={busy}>キャンセル</button>
          <button type="button" className="hbtn ghost" onClick={submit} disabled={busy || !text.trim()}>{busy ? '確認中…' : '追加する'}</button>
        </div>
      </div>
    </div>
  );
}

export default function MyEvents() {
  const [adding, setAdding] = useState(false);
  const [list, setList] = useState<MyEvent[]>(loadMyEvents);
  const [target, setTarget] = useState<MyEvent | null>(null);
  const [toast, setToast] = useState('');
  const [infos, setInfos] = useState<Record<string, EventInfo>>({});
  const sorted = shootingFirst(list, (e) => infos[e.id]?.status === 'shooting');
  // /host#import=... で複数イベントを一括で取り込む
  useEffect(() => {
    const n = importFromHash();
    if (n > 0) { setList(loadMyEvents()); setToast(`${n}件のイベントを追加しました`); }
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="host"><div className="host-in">
      {toast && !adding && <div className="toast" role="status">{toast}</div>}
      <p className="notice">ログインなしの試作のため、この端末で作ったイベントだけが表示されます</p>
      {list.length > 0 && <InstallHint />}
      {list.length === 0 ? (
        <div className="empty">
          <Cloud className="flow" style={{ width: '90px', position: 'static' }} />
          <h1>まだイベントがありません</h1>
          <p>最初のイベントを作って、ゲストに配るQRコードを出しましょう。</p>
          <Link className="hbtn ghost" to="/host/new">最初のイベントをつくる</Link>
          <button type="button" className="hbtn" onClick={() => setAdding(true)}>リンクで追加</button>
          <SampleLinks title="まずはサンプルを見る" />
          <Heart style={{ width: '40px', position: 'static' }} />
        </div>
      ) : (
        <ul className="evlist">
          {sorted.map((e) => <EventCard key={e.id} ev={e} onRemove={() => setTarget(e)} onInfo={(i) => setInfos((m) => (m[e.id]?.status === i.status ? m : { ...m, [e.id]: i }))} />)}
        </ul>
      )}
      {list.length > 0 && <button type="button" className="hbtn addlink" onClick={() => setAdding(true)}>リンクで追加</button>}
      {list.length > 0 && <SampleLinks />}
      <p className="notice">別の端末・ホーム画面のアプリで見るときは、管理用リンクを貼り付けて追加できます</p>
      {adding && <AddByLink onClose={() => setAdding(false)} onDone={(m) => { setAdding(false); setList(loadMyEvents()); setToast(m); setTimeout(() => setToast(''), 4000); }} />}
      {target && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="一覧から外す確認">
          <div className="dialog">
            <h2>一覧から外しますか？</h2>
            <p>「{target.name || target.id}」をこの端末の一覧から外します。サーバーのデータは消えません。</p>
            <div className="hrow">
              <button type="button" className="hbtn" onClick={() => setTarget(null)}>やめる</button>
              <button type="button" className="hbtn ghost" onClick={() => { removeMyEvent(target.id); setList(loadMyEvents()); setTarget(null); }}>外す</button>
            </div>
          </div>
        </div>
      )}
    </div></div>
  );
}
