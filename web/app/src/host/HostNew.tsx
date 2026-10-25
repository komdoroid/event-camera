import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type EventKind } from '../api';
import { DEFAULT_KIND, KINDS, eventNameOrExample, kindMeta, themeStyle } from '../lib/kinds';
import { KindIcon } from '../lib/KindIcon';
import { upsertMyEvent } from './myEvents';
import { saveHostToken } from './hostLib';
import './host.css';

const MESSAGE_MAX = 140;

export default function HostNew() {
  const nav = useNavigate();
  const [kind, setKind] = useState<EventKind>(DEFAULT_KIND);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('27');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(limit));
    if (!(n >= 1 && n <= 200)) return setErr('枚数は1〜200で指定してください');
    setBusy(true); setErr('');
    try {
      const note = message.trim();
      const ev = await api.createEvent({ name: eventNameOrExample(name, kind), shotLimit: n, kind, ...(note ? { message: note } : {}) });
      saveHostToken(ev.id, ev.hostToken);
      upsertMyEvent({ id: ev.id, name: ev.name });
      nav(`/host/${ev.id}`);
    } catch {
      setErr('作成に失敗しました。通信を確認して、もう一度お試しください。');
      setBusy(false);
    }
  }

  return (
    <div className="host" style={themeStyle(kind)}><form className="host-in" onSubmit={submit}>
      <h1>イベントをつくる</h1>
      <p>作ると、ゲストに配るQRコードが表示されます。</p>
      <fieldset className="kinds">
        <legend>どんなイベント？</legend>
        <div className="kindgrid">
          {KINDS.map((k) => (
            <button type="button" key={k.kind} className={'kindtile' + (k.kind === kind ? ' on' : '')} aria-pressed={k.kind === kind} style={themeStyle(k.kind)} onClick={() => setKind(k.kind)}>
              <KindIcon kind={k.kind} size={38} />
              <span>{k.label}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label>イベント名
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kindMeta(kind).example} maxLength={60} />
        <span className="hint">空のままだと「{kindMeta(kind).example}」になります</span>
      </label>
      <label>ゲスト1人あたりの枚数
        <input type="number" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} min={1} max={200} />
        <span className="hint">おすすめは27枚です</span>
      </label>
      <label>ゲストへのひとこと（任意）
        <textarea className="linkarea" rows={3} value={message} maxLength={MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} placeholder="例: 今日の一枚を、たくさん撮ってください" />
        <span className="hint counter">{message.length} / {MESSAGE_MAX}</span>
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="hbtn ghost" disabled={busy}>{busy ? '作成中…' : '作成する'}</button>
    </form></div>
  );
}
