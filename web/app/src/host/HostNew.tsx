import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { saveHostToken } from './hostLib';
import './host.css';

export default function HostNew() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('27');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(limit));
    if (!name.trim()) return setErr('イベント名を入力してください');
    if (!(n >= 1 && n <= 200)) return setErr('枚数は1〜200で指定してください');
    setBusy(true); setErr('');
    try {
      const ev = await api.createEvent({ name: name.trim(), shotLimit: n });
      saveHostToken(ev.id, ev.hostToken);
      nav(`/host/${ev.id}`);
    } catch {
      setErr('作成に失敗しました。通信を確認してください。');
      setBusy(false);
    }
  }

  return (
    <div className="host"><form className="host-in" onSubmit={submit}>
      <h1>イベントを作る</h1>
      <p>作ると、ゲストに配るQRコードが表示されます。</p>
      <label>イベント名
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kazuki & Misaki Wedding" maxLength={60} />
      </label>
      <label>ゲスト1人あたりの枚数
        <input type="number" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} min={1} max={200} />
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="hbtn" disabled={busy}>{busy ? '作成中…' : '作成する'}</button>
    </form></div>
  );
}
