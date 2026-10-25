import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Book, Envelope, Phone, Star } from '../diary/Doodles';
import { KindIcon } from '../lib/KindIcon';
import { markIntroSeen } from '../lib/intro';
import { themeStyle } from '../lib/kinds';
import { SAMPLE_DIARIES, sampleAlbumPath } from '../lib/samples';
import type { EventKind } from '../api';
import './host.css';

export function SampleLinks({ title = 'サンプルの絵日記を見る', onGo }: { title?: string; onGo?: () => void }) {
  return (
    <div className="samples">
      <h2>{title}</h2>
      <p className="notice">とどいたあとの絵日記を、鍵なしで見られます</p>
      <div className="samplerow">
        {SAMPLE_DIARIES.map((s) => <Link key={s.id} className="chip sample" to={sampleAlbumPath(s.id)} onClick={onGo}>{s.name}</Link>)}
      </div>
    </div>
  );
}

const row = (kinds: EventKind[]) => <div className="introicons">{kinds.map((k) => <KindIcon key={k} kind={k} size={46} />)}</div>;

const THEME_KINDS: EventKind[] = ['birthday', 'reunion', 'wedding']; // 黄・ミント・ピンク

const CARDS = [
  { title: 'イベントをつくる', text: '誕生日、飲み会、同窓会、旅行、社内イベント…。名前をつけて、QRコードを配るだけです。', art: row(['birthday', 'party', 'reunion', 'trip', 'company']) },
  { title: 'みんなが撮る', text: 'ゲストはQRを読むだけ。アプリも登録もいりません。現像するまで、だれも写真を見られません。', art: <div className="introicons"><KindIcon kind="trip" size={40} /><Phone style={{ width: 54, position: 'static' }} /><KindIcon kind="birthday" size={40} /></div> },
  { title: '絵日記がとどいて、みんなが買える', text: '現像すると、みんなの写真が1冊の絵日記になります。気に入ったら、ゲストが買って手元にのこせます。', art: <div className="introicons"><Envelope style={{ width: 80, position: 'static' }} /><Book style={{ width: 54, position: 'static' }} /><Star style={{ width: 36, position: 'static' }} /></div> },
];

/** 初回だけ出す3枚の紹介。スワイプか「つぎへ」で進む */
export default function Intro({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const last = i === CARDS.length - 1;
  const done = () => { markIntroSeen(); onClose(); };
  const go = (n: number) => ref.current?.scrollTo({ left: n * ref.current.clientWidth, behavior: 'smooth' });
  return (
    <div className="intro" style={themeStyle(THEME_KINDS[i])} role="dialog" aria-modal="true" aria-label="絵日記カメラのしくみ">
      <div className="introtop">{<button type="button" className="introskip" onClick={done}>スキップ</button>}</div>
      <div className="introtrack" ref={ref} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {CARDS.map((c, n) => (
          <section className="introcard" key={n} style={themeStyle(THEME_KINDS[n])} aria-label={`${n + 1} / ${CARDS.length}`}>
            {c.art}
            <h1>{c.title}</h1>
            <p>{c.text}</p>
            {n === CARDS.length - 1 && (
              <div className="introact">
                <button type="button" className="hbtn ghost" onClick={() => { done(); nav('/host/new'); }}>イベントをつくる</button>
                <SampleLinks onGo={() => markIntroSeen()} />
              </div>
            )}
          </section>
        ))}
      </div>
      <div className="introbot">
        <div className="dots" aria-hidden="true">{CARDS.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</div>
        {!last && <button type="button" className="hbtn ghost" onClick={() => go(i + 1)}>つぎへ</button>}
      </div>
    </div>
  );
}
