import { Fragment } from 'react';
import { phrases } from './phrase';

/**
 * 大きい見出し用。文節の間にだけ <wbr> を入れる。
 * 見出し側で `word-break: keep-all` にして、文節の途中では折れないようにする（iOS Safari でも効く）。
 */
export default function Phrase({ text }: { text: string }) {
  const ps = phrases(text);
  return <>{ps.map((s, i) => <Fragment key={i}>{i > 0 && <wbr />}{s}</Fragment>)}</>;
}
