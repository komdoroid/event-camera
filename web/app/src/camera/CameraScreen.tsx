import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventInfo } from '../api';
import { loadHostToken } from '../host/hostLib';
import { useThemeColor } from '../lib/useThemeColor';
import { useAlive } from '../lib/useAlive';
import { copyFor } from '../diary/copy';
import { titleSize } from '../diary/format';
import { Star, Sun, Wash } from '../diary/Doodles';
import PermissionHelp from './PermissionHelp';
import { DIAL_R, dialRidges } from './dial';
import './camera.css';
import { captureFrame } from './capture';
import { refund, shoot, startFilm, wind, WIND_NEED, type Film } from './film';
import { uploadQueue, type FailReason } from './uploader';
import { usePendingUploads } from './usePending';

interface Props { event: EventInfo; guestId: string; initialRemaining: number; onFinished: () => void; onClosed: () => void; welcome?: boolean }
type Cam = 'idle' | 'starting' | 'live' | 'error';

const pad = (n: number) => (n < 10 ? '0' : '') + n;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stampOf = (d: Date) =>
  `'${pad(d.getFullYear() % 100)} ${pad(d.getMonth() + 1)} ${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 数字が回るカウンター */
function Roll({ value }: { value: number }) {
  const [prev, setPrev] = useState<number | null>(null);
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    if (!reduced()) {
      setPrev(last.current);
      const t = setTimeout(() => setPrev(null), 400);
      last.current = value;
      return () => clearTimeout(t);
    }
    last.current = value;
  }, [value]);
  return (
    <span className="roll" aria-label={`残り${value}枚`}>
      {prev !== null && <span className="out" key={'o' + prev}>{pad(prev)}</span>}
      <span className={prev !== null ? 'in' : undefined} key={'v' + value}>{pad(value)}</span>
    </span>
  );
}

/** 遠近法の円筒。うね x = R*sin(θ+phase)。中央は幅広く明るく、端は詰まって暗い */
function DialSvg({ phase }: { phase: number }) {
  const R = DIAL_R, W = 2 * R, H = 76;
  return (
    <svg className="dsvg" data-phase={phase.toFixed(3)} viewBox={`${-R} 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%">
      <defs>
        <linearGradient id="dshade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".95" /><stop offset=".25" stopColor="#000" stopOpacity=".5" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".22" /><stop offset=".75" stopColor="#000" stopOpacity=".5" />
          <stop offset="1" stopColor="#000" stopOpacity=".95" />
        </linearGradient>
        <linearGradient id="dvert" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".4" /><stop offset=".25" stopColor="#000" stopOpacity="0" />
          <stop offset=".75" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".4" />
        </linearGradient>
      </defs>
      <rect x={-R} y="0" width={W} height={H} fill="#34363d" />
      <g className="dg">
        {dialRidges(phase).map((r, i) => (
          <g key={i}>
            <line x1={r.x} x2={r.x} y1="0" y2={H} stroke="#0b0c0f" strokeWidth={(3.4 * r.w).toFixed(2)} />
            <line x1={r.x + 2.2 * r.w} x2={r.x + 2.2 * r.w} y1="0" y2={H} stroke="#c3c8d2" strokeOpacity={(0.85 * r.c).toFixed(2)} strokeWidth={(0.9 * r.w).toFixed(2)} />
          </g>
        ))}
      </g>
      <rect x={-R} y="0" width={W} height={H} fill="url(#dshade)" />
      <rect x={-R} y="0" width={W} height={H} fill="url(#dvert)" />
    </svg>
  );
}

export default function CameraScreen({ event, guestId, initialRemaining, onFinished, onClosed, welcome = false }: Props) {
  const [film, setFilm] = useState<Film>(() => startFilm(initialRemaining));
  const filmRef = useRef(film);
  const [cam, setCam] = useState<Cam>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [denied, setDenied] = useState(false);
  const C = copyFor(event.kind);
  const showWelcome = welcome && (cam === 'idle' || cam === 'starting');
  const [now, setNow] = useState(() => new Date());
  const [toast, setToast] = useState('');
  const [wx, setWx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const finishTimer = useRef(0);
  const toastTimer = useRef(0);
  const alive = useAlive();
  useThemeColor(showWelcome ? '#ffffff' : '#0b0c0f');
  const pending = usePendingUploads();

  const update = (f: Film) => { filmRef.current = f; setFilm(f); };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearTimeout(finishTimer.current);
    clearTimeout(toastTimer.current);
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 5000);
  }, []);

  // iOS Safari はユーザー操作から開始する必要があるため、ボタンで呼ぶ
  async function startCamera() {
    setCam('starting');
    setDenied(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 2048 }, height: { ideal: 2048 } },
        audio: false,
      });
      if (!alive.current) { stream.getTracks().forEach((t) => t.stop()); return; } // 画面を離れた後に許可された場合
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setCam('live');
    } catch (e) {
      const name = (e as DOMException).name;
      setDenied(name === 'NotAllowedError');
      setErrMsg('カメラを開始できませんでした。HTTPS で開いているか、ほかのアプリがカメラを使っていないか確認してください。');
      setCam('error');
    }
  }

  function flash() {
    const f = flashRef.current;
    if (!f) return;
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }
  function nudge() {
    const w = wheelRef.current;
    if (!w) return;
    w.classList.remove('nudge'); void w.offsetWidth; w.classList.add('nudge');
  }

  function onShutter() {
    const cur = filmRef.current;
    if (cam !== 'live') return;
    if (!cur.wound && cur.remaining > 0) { nudge(); return; }
    const next = shoot(cur);
    if (!next) return;
    navigator.vibrate?.(30); // 非対応の端末では何もしない
    const video = videoRef.current!;
    const jpeg = captureFrame(video); // クリック時点のフレームを取り込む
    update(next);
    flash();
    jpeg
      .then((blob) =>
        uploadQueue.enqueue({ eventId: event.id, guestId, blob }, (reason: FailReason) => {
          if (!alive.current) return;
          if (reason === 'closed') {
            // 現像済みだった: 先に減らしたカウンターを戻して、画面を切りかえる
            update(refund(filmRef.current));
            onClosed();
          } else {
            notify(reason === 'limit' ? '上限に達していたため、1枚は保存されませんでした' : '送信できず、1枚は保存されませんでした');
          }
        }),
      )
      .catch(() => notify('撮影に失敗しました'));
    if (next.remaining === 0) {
      // 送信が終わるまで少し待ってから現像待ちへ（キューは画面を離れても続く）
      finishTimer.current = window.setTimeout(onFinished, reduced() ? 500 : 1200);
    }
  }

  // 巻き上げ（横スワイプ）
  const drag = useRef<{ x: number } | null>(null);
  const advance = (dx: number) => {
    const cur = filmRef.current;
    if (cur.wound || cur.remaining <= 0) return; // 巻き切ったらそれ以上回らない
    const next = wind(cur, dx);
    update(next);
    setWx((x) => x + dx);
    if (next.wound) {
      navigator.vibrate?.(15);
      const d = dialRef.current;
      if (d && !reduced()) { d.classList.remove('clunk'); void d.offsetWidth; d.classList.add('clunk'); }
    }
  };
  const wheelHandlers = {
    onPointerDown(e: React.PointerEvent) {
      const f = filmRef.current;
      if (f.wound || f.remaining <= 0) return;
      drag.current = { x: e.clientX };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    },
    onPointerMove(e: React.PointerEvent) {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x;
      drag.current.x = e.clientX;
      advance(dx);
    },
    onPointerUp() { drag.current = null; },
    onPointerCancel() { drag.current = null; },
    onKeyDown(e: React.KeyboardEvent) {
      if (e.key === 'ArrowRight') { advance(24); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { advance(-24); e.preventDefault(); }
    },
  };

  const pct = film.wound ? 100 : Math.min(100, (film.progress / WIND_NEED) * 100);
  const total = event.shotLimit;
  const done = film.remaining === 0;

  return (
    <section className="cam" data-wound={film.wound ? '1' : '0'} data-end={done ? '1' : '0'}>
      <div className="cam-top"><span className="lbl evname">{event.name}</span>{pending > 0 && <span className="lbl sending">送信中 {pending} 枚</span>}{loadHostToken(event.id) && <Link className="lbl hostback" to={`/host/${event.id}`}>管理画面へ</Link>}</div>
      <div className="cam-mid">
        <div className="viewf">
          <video ref={videoRef} playsInline muted autoPlay />
          <i className="g gv" style={{ left: '33.333%' }} /><i className="g gv" style={{ left: '66.666%' }} />
          <i className="g gh" style={{ top: '33.333%' }} /><i className="g gh" style={{ top: '66.666%' }} />
          <div className="vf-tl">{total} EXP.</div>
          {!film.wound && cam === 'live' && <div className="vf-hint">{done ? 'フィルム終了' : '巻き上げてください'}</div>}
          {toast && <div className="vf-toast" role="status">{toast}</div>}
          <div className="vf-br">{stampOf(now)}</div>
        </div>
        {cam !== 'live' && !showWelcome && (
          <div className="start">
            {cam === 'error' && (denied ? <PermissionHelp /> : <p role="alert">{errMsg}</p>)}
            <button type="button" className="btn" onClick={startCamera} disabled={cam === 'starting'}>
              {cam === 'starting' ? '起動中…' : cam === 'error' ? C.denied.retry : C.welcome.start}
            </button>
            {cam === 'idle' && <p>撮った写真は、現像されるまで見られません。<br />残り {film.remaining} 枚。</p>}
          </div>
        )}
      </div>
      <div className="cam-bot">
        <div
          className="wheel" ref={wheelRef} role="slider" tabIndex={0} aria-label="巻き上げ。左右にスワイプ"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
          style={{ ['--wp' as string]: pct + '%', }}
          {...wheelHandlers}
        >
          <div className="wtrack">
            <span className="arrow" aria-hidden="true">›</span>
            <span className="wlabel"><i className="lamp" />{film.wound ? 'READY' : done ? 'END' : '← 巻き上げ →'}</span>
            <div className="wbar"><i /></div>
          </div>
          <div className="dial" ref={dialRef} aria-hidden="true"><DialSvg phase={wx / DIAL_R} /></div>
        </div>
        <div className="cam-row">
          <div>
            <div className="lbl">残り</div>
            <div className="num"><Roll value={film.remaining} /><small>/ {total}</small></div>
          </div>
          <button type="button" className="shutter" aria-label="シャッター" onClick={onShutter} disabled={cam !== 'live'}><span /></button>
          <div className="lbl stat">{done ? '撮り終えました' : film.wound ? '撮影できます' : '巻き上げ待ち'}</div>
        </div>
      </div>
      <div className="flash" ref={flashRef} />
      {showWelcome && (
        <div className="welcome-ov">
          <div className="diary"><div className="dpage screen">
            <Wash color="blue" style={{ left: '-10cqw', top: '10cqw', width: '80cqw', height: '60cqw' }} />
            <Wash color="pink" style={{ right: '-12cqw', bottom: '-8cqw', width: '70cqw', height: '60cqw' }} />
            <Sun className="flow bob" style={{ width: '22cqw' }} />
            <p className="note" style={{ position: 'relative', zIndex: 1 }}>{C.welcomeLead}</p>
            <h1 className="dtitle" style={{ fontSize: `${titleSize(event.name, 9)}cqw` }}>{event.name}</h1>
            {event.message && <p className="hostmsg">{event.message}</p>}
            <ul className="rules">{C.welcome.rules(event.shotLimit).map((r, i) => <li key={r}><b>{i + 1}</b>{r}</li>)}</ul>
            <Star className="flow" style={{ width: '9cqw' }} />
            <button type="button" className="hbtn2" onClick={startCamera} disabled={cam === 'starting'}>{cam === 'starting' ? C.welcome.starting : C.welcome.start}</button>
          </div></div>
        </div>
      )}
    </section>
  );
}
