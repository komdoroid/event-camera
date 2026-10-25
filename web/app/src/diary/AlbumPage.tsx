import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, type Album, type AlbumPhoto, type Order, type Product } from '../api';
import { getGuestId } from '../lib/guestId';
import { loadHostToken } from '../host/hostLib';
import { backTarget } from './backTarget';
import { coverStyle, pageColorStyle, themeStyle } from '../lib/kinds';
import { copyFor } from './copy';
import type { CSSProperties } from 'react';
import { Arrow, Book, Confetti, Heart, Phone, Squiggle, Star, Sun, Wash } from './Doodles';
import { LoadPhoto } from './LoadPhoto';
import { formatDay, formatDot, formatTime, pageKind, shortOrder, yen } from './format';
import { clampPage, countMine, loadPurchased, printPageCount, savePurchased, swipeDir, totalPages, visiblePages } from './paging';
import './diary.css';

type Page = Album['pages'][number];
type CopyT = ReturnType<typeof copyFor>;

function Cover({ album, page, C }: { album: Album; page: Page; C: CopyT }) {
  const p = page.photos[0];
  return (
    <section className="dpage cover" style={coverStyle(album.event.kind)}>
      <Wash color="theme" style={{ left: '-10cqw', top: '30cqw', width: '80cqw', height: '70cqw' }} />
      <Wash color="yellow" style={{ right: '-12cqw', bottom: '-8cqw', width: '70cqw', height: '60cqw' }} />
      <Confetti className="cf" style={{ right: '6cqw', top: '6cqw', width: '28cqw' }} />
      <div className="note vol">{C.albumTitle.join('')} ・ {C.vol}{p ? ` ・ ${formatDot(p.takenAt)}` : ''}</div>
      <h1 style={{ fontSize: album.event.name.length > 12 ? '9cqw' : '12cqw' }}>{album.event.name}</h1>
      {p && <LoadPhoto src={p.url} mine={!!p.mine} tilt={2.5} tape ratio="5 / 4" />}
      <div className="note evn">{C.endStats(album.stats.guests, album.stats.photos)}</div>
      <Heart style={{ right: '6cqw', top: '44cqw', width: '12cqw', '--df': 'var(--h-orange)' } as CSSProperties} />
    </section>
  );
}

const TILTS = [-1.5, 1.8, -2, 1.2];
function Diary({ page, index, C }: { page: Page; index: number; C: CopyT }) {
  const photos: AlbumPhoto[] = page.photos;
  const kind = pageKind(page.layout, photos.length);
  const first = photos[0];
  const memo = C.pageMemos[index % C.pageMemos.length];
  return (
    <section className="dpage tinted" style={pageColorStyle(index)}>
      <Wash color="page" style={{ right: '-14cqw', bottom: '-10cqw', width: '70cqw', height: '55cqw' }} />
      <div className="dhead">
        <span>{formatDay(first.takenAt)}</span><span className="note" style={{ fontWeight: 400 }}>{C.weather}</span>
        <Sun /><span className="note time">{formatTime(first.takenAt)}</span>
      </div>
      <Squiggle />
      <div className={`dbody ${kind === 'cover' ? 'full' : kind}`}>
        {photos.map((p, i) => (
          <LoadPhoto key={p.id} src={p.url} mine={!!p.mine} tilt={TILTS[(index + i) % TILTS.length]} ratio={kind === 'grid' ? '1 / 1' : kind === 'full' ? '4 / 3' : '3 / 2'} tape={i === 0} />
        ))}
      </div>
      <div className="dlines"><p className="note">{memo}<br />{formatTime(first.takenAt)} ・ {C.attribution}</p></div>
      <div className="dtail">{index % 4 === 1 ? <Confetti className="cf" style={{ width: '22cqw' }} /> : index % 2 ? <Arrow style={{ width: '14cqw' }} /> : <Star />}{index % 3 === 0 ? <Heart /> : <Sun style={{ width: '12cqw' }} />}</div>
    </section>
  );
}

function End({ album, C, purchased, onBuy, onSave }: { album: Album; C: CopyT; purchased: string[]; onBuy: () => void; onSave: () => void }) {
  const mine = countMine(album.pages);
  const bought = purchased.length > 0;
  return (
    <section className="dpage end" style={themeStyle(album.event.kind)}>
      <Wash color="yellow" style={{ left: '-10cqw', top: '4cqw', width: '70cqw', height: '55cqw' }} />
      <Wash color="theme" style={{ right: '-12cqw', bottom: '-6cqw', width: '80cqw', height: '60cqw' }} />
      <Confetti className="cf" style={{ left: '4cqw', top: '4cqw', width: '30cqw' }} />
      <Confetti className="cf" style={{ right: '4cqw', top: '10cqw', width: '26cqw', transform: 'scaleX(-1)' }} />
      <div className="trio"><Star style={{ '--df': 'var(--h-mint)', width: '12cqw' } as CSSProperties} /><Heart style={{ width: '17cqw' }} /><Star style={{ '--df': 'var(--h-purple)', width: '12cqw' } as CSSProperties} /></div>
      <div className="big">{C.endStats(album.stats.guests, album.stats.photos)}</div>
      {mine > 0 && <p className="note">{C.mineCount(mine)}</p>}
      {bought ? (
        <>
          <p className="paidtag">{C.purchased}</p>
          {purchased.includes('digital') && <button type="button" className="hbtn2 pri" onClick={onSave}>{C.savePhotos}</button>}
        </>
      ) : (
        <>
          <p>{C.endAsk}</p>
          <button type="button" className="hbtn2 pri" onClick={onBuy}>{C.endButton}</button>
        </>
      )}
    </section>
  );
}

const PRICE_OVAL = (
  <svg className="wob" viewBox="0 0 100 40" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><ellipse cx="50" cy="20" rx="46" ry="16" /></svg>
);
const PRICES: Record<Product, number> = { digital: 500, print: 3000 }; // 表示用。確定額は注文の返り値

function Buy({ eventId, kind, C, pages, onDone, onBack }: { eventId: string; kind: string; C: CopyT; pages: number; onDone: (o: Order) => void; onBack: () => void }) {
  const [busy, setBusy] = useState<Product | null>(null);
  const [err, setErr] = useState(false);
  async function buy(p: Product) {
    setBusy(p); setErr(false);
    try { onDone(await api.createOrder(eventId, getGuestId(), p)); } catch { setErr(true); setBusy(null); }
  }
  return (
    <section className="dpage buy" style={themeStyle(kind)}>
      <Confetti className="cf" style={{ right: '4cqw', top: '4cqw', width: '28cqw' }} />
      <h2 className="dtitle">{C.buyTitle}</h2>
      {(['digital', 'print'] as Product[]).map((p) => (
        <div className="hcard" key={p}>
          <div className="name">{C.products[p].name}</div>
          <div className="price">{PRICE_OVAL}{yen(PRICES[p])}</div>
          <ul>
            {p === 'print' && <li>{C.products.print.pages(pages)}</li>}
            {C.products[p].features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          {p === 'digital' ? <Phone className="vis" /> : <Book className="vis" />}
          <button type="button" className={'hbtn2' + (p === 'digital' ? ' pri' : '')} disabled={busy !== null} onClick={() => buy(p)}>{busy === p ? C.buying : C.buy}</button>
        </div>
      ))}
      {err && <p className="errtxt" role="alert">{C.buyError}</p>}
      <p className="note" style={{ fontSize: '3.4cqw', position: 'relative' }}>{C.mockNote}</p>
      <p style={{ marginTop: '4cqw' }}><button type="button" className="hbtn2" style={{ fontSize: '4cqw' }} onClick={onBack}>{C.backToAlbum}</button></p>
    </section>
  );
}

function Done({ order, album, C, eventId, onBack }: { order: Order; album: Album; C: CopyT; eventId: string; onBack: () => void }) {
  const photos = album.pages.flatMap((p) => p.photos);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', zip: '', address: '' });
  async function share() {
    const url = `${location.origin}/e/${eventId}/album`;
    const text = C.doneDigital.shareText(album.event.name);
    try {
      if (navigator.share) { await navigator.share({ title: album.event.name, text, url }); return; }
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return; // 共有シートを閉じただけ
    }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setMsg(C.doneDigital.copied); } catch { setMsg(C.doneDigital.copyFail); }
  }
  const ok = form.name.trim() && form.zip.trim() && form.address.trim();
  return (
    <section className="dpage donep" style={themeStyle(album.event.kind)}>
      <Wash color="theme" style={{ left: '10cqw', top: '10cqw', width: '80cqw', height: '50cqw' }} />
      <Confetti className="cf" style={{ left: '4cqw', top: '4cqw', width: '30cqw' }} />
      <Confetti className="cf" style={{ right: '4cqw', top: '8cqw', width: '26cqw', transform: 'scaleX(-1)' }} />
      <Star className="flow bob" style={{ width: '20cqw', position: 'static' }} />
      <h1 className="dtitle">{C.doneTitle}</h1>
      <p><b>{C.products[order.product].name}</b> ・ {yen(order.amount)}{order.orderId && <><br /><span className="note">注文番号 #{shortOrder(order.orderId)}</span></>}</p>
      {order.product === 'digital' ? (
        <>
          <p>{C.doneDigital.lead}</p>
          <div className="plist">
            {photos.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" loading="lazy" /></a>)}
          </div>
          <button type="button" className="hbtn2 pri" onClick={share}>{C.doneDigital.share}</button>
          {msg && <p className="note" role="status">{msg}</p>}
        </>
      ) : sent ? (
        <p role="status"><b>{C.donePrint.received}</b></p>
      ) : (
        <form className="dform" onSubmit={(e) => { e.preventDefault(); if (ok) setSent(true); }}>
          <p style={{ textAlign: 'center' }}>{C.donePrint.lead}</p>
          <label>{C.donePrint.name}<input value={form.name} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>{C.donePrint.zip}<input value={form.zip} inputMode="numeric" autoComplete="postal-code" onChange={(e) => setForm({ ...form, zip: e.target.value })} /></label>
          <label>{C.donePrint.address}<input value={form.address} autoComplete="street-address" onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <button type="submit" className="hbtn2 pri" disabled={!ok} style={{ justifySelf: 'center' }}>{C.donePrint.submit}</button>
        </form>
      )}
      <p className="note bn">{C.mockNote}</p>
      <button type="button" className="hbtn2 small" onClick={onBack}>{C.backToAlbum}</button>
    </section>
  );
}

function BackButton({ eventId, spacer = true }: { eventId: string; spacer?: boolean }) {
  const nav = useNavigate();
  const loc = useLocation();
  const go = () => {
    const t = backTarget({ eventId, locationKey: loc.key, hasHostToken: !!loadHostToken(eventId) });
    if (t.type === 'history') nav(-1); else nav(t.path, { replace: true });
  };
  return (
    <>
      <button type="button" className="backbtn" onClick={go} aria-label="もどる">‹ もどる</button>
      {spacer && <div className="backgap" aria-hidden="true" />}
    </>
  );
}

export default function AlbumPage() {
  const { eventId = '' } = useParams();
  const [album, setAlbum] = useState<Album | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ok' | 'closed'>('loading');
  const [view, setView] = useState<'album' | 'buy' | 'done'>('album');
  const [order, setOrder] = useState<Order | null>(null);
  const [tick, setTick] = useState(0);
  const [idx, setIdx] = useState(0);
  const [purchased, setPurchased] = useState<string[]>(() => loadPurchased(eventId));
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setState('loading');
    api.getAlbum(eventId, getGuestId())
      .then((a) => { if (alive) { setAlbum(a); setState('ok'); } })
      .catch((e) => { if (alive) setState(e?.status === 403 ? 'closed' : 'error'); });
    return () => { alive = false; };
  }, [eventId, tick]);

  useEffect(() => { document.querySelector('.diary')?.scrollTo(0, 0); }, [view, idx]);

  const total = album ? totalPages(album.pages) : 1;
  const go = (d: number) => setIdx((i) => clampPage(i + d, total));
  useEffect(() => {
    if (view !== 'album') return;
    const h = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const C = copyFor(album?.event.kind);

  if (state !== 'ok' || !album)
    return (
      <div className="diary"><BackButton eventId={eventId} spacer={false} /><div className="dpage screen">
        {state === 'loading' ? <p>…</p> : state === 'closed' ? (
          <><h1 className="dtitle">まだ現像前です</h1><p>現像されるまで、絵日記は開けません。</p></>
        ) : (
          <><p className="errtxt">{C.albumLoadError}</p><button className="hbtn2 pri" onClick={() => setTick((t) => t + 1)}>{C.retry}</button></>
        )}
      </div></div>
    );

  const pages = visiblePages(album.pages);
  const cur = clampPage(idx, total);
  const isEnd = cur === pages.length;
  const pg = pages[cur];
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current; touch.current = null;
    if (!t || view !== 'album') return;
    const c = e.changedTouches[0];
    const d = swipeDir(c.clientX - t.x, c.clientY - t.y);
    if (d) go(d);
  };

  return (
    <div
      className={`diary${view === 'album' ? ' paged' : ''}`}
      style={themeStyle(album.event.kind)}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={onTouchEnd}
    >
      <BackButton eventId={eventId} />
      {view === 'album' && (
        <>
          {isEnd
            ? <End album={album} C={C} purchased={purchased} onBuy={() => setView('buy')} onSave={() => { setOrder({ orderId: '', product: 'digital', amount: 500, status: 'paid_mock' }); setView('done'); }} />
            : pg.layout === 'cover' ? <Cover album={album} page={pg} C={C} /> : <Diary page={pg} index={cur} C={C} />}
          <nav className="pager" aria-label="ページ">
            <button type="button" className="hbtn2" onClick={() => go(-1)} disabled={cur === 0}>{C.prev}</button>
            <span className="pn" aria-live="polite">{cur + 1} / {total}</span>
            <button type="button" className="hbtn2 pri" onClick={() => go(1)} disabled={cur === total - 1}>{C.next}</button>
          </nav>
        </>
      )}
      {view === 'buy' && <Buy eventId={eventId} kind={album.event.kind} C={C} pages={printPageCount(album.pages)} onBack={() => setView('album')} onDone={(o) => { savePurchased(eventId, o.product); setPurchased(loadPurchased(eventId)); setOrder(o); setView('done'); }} />}
      {view === 'done' && order && <Done order={order} album={album} C={C} eventId={eventId} onBack={() => setView('album')} />}
    </div>
  );
}
