import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Album, type AlbumPhoto, type Order, type Product } from '../api';
import { getGuestId } from '../lib/guestId';
import { COPY } from './copy';
import { Arrow, Book, Cloud, Heart, Phone, Photo, Star, Sun, Wash } from './Doodles';
import { formatDay, formatDot, formatTime, pageKind, shortOrder, yen } from './format';
import './diary.css';

type Page = Album['pages'][number];

function Cover({ album, page }: { album: Album; page: Page }) {
  const p = page.photos[0];
  return (
    <section className="dpage cover">
      <Wash color="blue" style={{ left: '-10cqw', top: '30cqw', width: '80cqw', height: '70cqw' }} />
      <Wash color="pink" style={{ right: '-12cqw', bottom: '-8cqw', width: '70cqw', height: '60cqw' }} />
      <div className="note vol">{COPY.vol}{p ? ` ・ ${formatDot(p.takenAt)}` : ''}</div>
      <h1>{COPY.albumTitle[0]}<br />{COPY.albumTitle[1]}</h1>
      {p && <Photo src={p.url} tilt={2.5} tape ratio="5 / 4" />}
      <div className="note evn">{album.event.name}<br />{COPY.endStats(album.stats.guests, album.stats.photos)}</div>
      <Heart style={{ right: '6cqw', top: '44cqw', width: '12cqw' }} />
    </section>
  );
}

const TILTS = [-1.5, 1.8, -2, 1.2];
function Diary({ page, index }: { page: Page; index: number }) {
  const photos: AlbumPhoto[] = page.photos;
  if (photos.length === 0) return null;
  const kind = pageKind(page.layout, photos.length);
  const first = photos[0];
  const memo = COPY.pageMemos[index % COPY.pageMemos.length];
  return (
    <section className="dpage">
      <div className="dhead">
        <span>{formatDay(first.takenAt)}</span><span className="note" style={{ fontWeight: 400 }}>{COPY.weather}</span>
        <Sun /><span className="note time">{formatTime(first.takenAt)}</span>
      </div>
      <div className={`dbody ${kind === 'cover' ? 'full' : kind}`}>
        {photos.map((p, i) => (
          <Photo key={p.id} src={p.url} tilt={TILTS[(index + i) % TILTS.length]} ratio={kind === 'grid' ? '1 / 1' : kind === 'full' ? '4 / 3' : '3 / 2'} tape={kind === 'full' && i === 0} />
        ))}
      </div>
      <div className="dlines"><p className="note">{memo}<br />{formatTime(first.takenAt)} ・ {COPY.attribution}</p></div>
      <div className="dtail">{index % 2 ? <Arrow style={{ width: '14cqw' }} /> : <Star />}{index % 3 === 0 ? <Heart /> : <Cloud style={{ width: '14cqw' }} />}</div>
    </section>
  );
}

function End({ album, onBuy }: { album: Album; onBuy: () => void }) {
  return (
    <section className="dpage end">
      <Wash color="pink" style={{ left: '10cqw', top: '10cqw', width: '80cqw', height: '60cqw' }} />
      <Heart />
      <div className="big">{COPY.endStats(album.stats.guests, album.stats.photos)}</div>
      <p>{COPY.endAsk}</p>
      <button type="button" className="hbtn2" onClick={onBuy}>{COPY.endButton}</button>
    </section>
  );
}

const PRICE_OVAL = (
  <svg className="wob" viewBox="0 0 100 40" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><ellipse cx="50" cy="20" rx="46" ry="16" /></svg>
);
const PRICES: Record<Product, number> = { digital: 500, print: 3000 }; // 表示用。確定額は注文の返り値

function Buy({ eventId, onDone, onBack }: { eventId: string; onDone: (o: Order) => void; onBack: () => void }) {
  const [busy, setBusy] = useState<Product | null>(null);
  const [err, setErr] = useState(false);
  async function buy(p: Product) {
    setBusy(p); setErr(false);
    try { onDone(await api.createOrder(eventId, getGuestId(), p)); } catch { setErr(true); setBusy(null); }
  }
  return (
    <section className="dpage buy">
      <h2 className="dtitle">{COPY.buyTitle}</h2>
      {(['digital', 'print'] as Product[]).map((p) => (
        <div className="hcard" key={p}>
          <div className="name">{COPY.products[p].name}</div>
          <div className="price">{PRICE_OVAL}{yen(PRICES[p])}</div>
          <ul>{COPY.products[p].features.map((f) => <li key={f}>{f}</li>)}</ul>
          {p === 'digital' ? <Phone className="vis" /> : <Book className="vis" />}
          <button type="button" className="hbtn2" disabled={busy !== null} onClick={() => buy(p)}>{busy === p ? COPY.buying : COPY.buy}</button>
        </div>
      ))}
      {err && <p className="errtxt" role="alert">{COPY.buyError}</p>}
      <p className="note" style={{ fontSize: '3.4cqw', position: 'relative' }}>{COPY.mockNote}</p>
      <p style={{ marginTop: '4cqw' }}><button type="button" className="hbtn2" style={{ fontSize: '4cqw' }} onClick={onBack}>{COPY.backToAlbum}</button></p>
    </section>
  );
}

function Done({ order, onBack }: { order: Order; onBack: () => void }) {
  return (
    <section className="dpage screen">
      <Wash color="blue" style={{ left: '10cqw', top: '20cqw', width: '80cqw', height: '60cqw' }} />
      <Star className="flow bob" style={{ width: '22cqw' }} />
      <h1 className="dtitle">{COPY.doneTitle}</h1>
      <p><b>{COPY.products[order.product].name}</b> ・ {yen(order.amount)}<br /><span className="note">注文番号 #{shortOrder(order.orderId)}</span></p>
      <p>{COPY.doneNext[order.product]}</p>
      <p className="note" style={{ fontSize: '3.4cqw' }}>{COPY.mockNote}</p>
      <button type="button" className="hbtn2" onClick={onBack}>{COPY.backToAlbum}</button>
    </section>
  );
}

export default function AlbumPage() {
  const { eventId = '' } = useParams();
  const [album, setAlbum] = useState<Album | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ok' | 'closed'>('loading');
  const [view, setView] = useState<'album' | 'buy' | 'done'>('album');
  const [order, setOrder] = useState<Order | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState('loading');
    api.getAlbum(eventId)
      .then((a) => { if (alive) { setAlbum(a); setState('ok'); } })
      .catch((e) => { if (alive) setState(e?.status === 403 ? 'closed' : 'error'); });
    return () => { alive = false; };
  }, [eventId, tick]);

  useEffect(() => { document.querySelector('.diary')?.scrollTo(0, 0); }, [view]);

  if (state !== 'ok' || !album)
    return (
      <div className="diary"><div className="dpage screen">
        {state === 'loading' ? <p>…</p> : state === 'closed' ? (
          <><h1 className="dtitle">まだ現像前です</h1><p>現像されるまで、絵日記は開けません。</p><Link className="hbtn2" to={`/e/${eventId}`}>もどる</Link></>
        ) : (
          <><p className="errtxt">{COPY.albumLoadError}</p><button className="hbtn2" onClick={() => setTick((t) => t + 1)}>{COPY.retry}</button></>
        )}
      </div></div>
    );

  return (
    <div className="diary">
      {view === 'album' && (
        <>
          {album.pages.map((pg, i) => pg.layout === 'cover' ? <Cover key={i} album={album} page={pg} /> : <Diary key={i} page={pg} index={i} />)}
          <End album={album} onBuy={() => setView('buy')} />
        </>
      )}
      {view === 'buy' && <Buy eventId={eventId} onBack={() => setView('album')} onDone={(o) => { setOrder(o); setView('done'); }} />}
      {view === 'done' && order && <Done order={order} onBack={() => setView('album')} />}
    </div>
  );
}
