import { COPY } from '../diary/copy';
import { detectPlatform } from './platform';

/** カメラの許可が拒否されたときの、端末別の戻し方 */
export default function PermissionHelp() {
  const p = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const items = p === 'ios' ? [COPY.denied.ios] : p === 'android' ? [COPY.denied.android] : [COPY.denied.ios, COPY.denied.android];
  return (
    <div className="deny" role="alert">
      <p className="deny-t">{COPY.denied.title}</p>
      <p>{COPY.denied.lead}</p>
      {items.map(([name, steps]) => (
        <div className="deny-box" key={name as string}>
          <b>{name as string}</b>
          <ol>{(steps as string[]).map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      ))}
    </div>
  );
}
