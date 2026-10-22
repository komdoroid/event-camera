import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import './host.css';

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

function titleOf(path: string) {
  if (path === '/host' || path === '/host/') return 'マイイベント';
  if (path === '/host/new') return 'イベントをつくる';
  return 'イベント管理';
}

/** ホスト側だけのアプリの枠: 上部バー + 下部タブ */
export default function HostShell() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const root = pathname === '/host' || pathname === '/host/';
  const isNew = pathname === '/host/new';
  return (
    <div className="hshell">
      <header className="htop">
        {!root && !isNew ? (
          <button type="button" className="hback" aria-label="マイイベントにもどる" onClick={() => nav('/host')}>
            <Icon d="M15 5 L8 12 L15 19" />
          </button>
        ) : <span className="hback-sp" />}
        <span className="htitle">{titleOf(pathname)}</span>
        <span className="hback-sp" />
      </header>
      <main className="hmain">
        <div className="hpage" key={pathname}><Outlet /></div>
      </main>
      <nav className="htabs" aria-label="メニュー">
        <NavLink to="/host" className={() => 'tab' + (!isNew ? ' on' : '')} aria-current={!isNew ? 'page' : undefined}>
          <Icon d="M4 11 L12 4 L20 11 V20 H4 Z" /><span>ホーム</span>
        </NavLink>
        <NavLink to="/host/new" className={() => 'tab' + (isNew ? ' on' : '')} aria-current={isNew ? 'page' : undefined}>
          <Icon d="M12 5 V19 M5 12 H19" /><span>つくる</span>
        </NavLink>
      </nav>
    </div>
  );
}
