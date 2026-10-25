import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Phrase from './Phrase';
import { phrases } from './phrase';

describe('phrases', () => {
  it('つなげると元の文字列に戻る', () => {
    for (const t of ['ウェディングパーティー', '株式会社サンプル創立二十周年記念パーティー懇親会', 'abc', '']) expect(phrases(t).join('')).toBe(t);
  });
  it('語の途中では分けない', () => {
    expect(phrases('ウェディングパーティー')).toEqual(['ウェディングパーティー']);
    expect(phrases('創立二十周年記念').join('|')).not.toMatch(/二十周\|年/);
  });
  it('空文字は空配列', () => expect(phrases('')).toEqual([]));
});

describe('Phrase', () => {
  it('文節の間にだけ wbr が入る', () => {
    const ps = phrases('株式会社サンプル創立二十周年記念パーティー懇親会');
    const html = renderToStaticMarkup(<Phrase text="株式会社サンプル創立二十周年記念パーティー懇親会" />);
    expect(html.split('<wbr/>').length - 1).toBe(ps.length - 1);
    expect(html.replace(/<wbr\/>|<\/?span[^>]*>/g, '')).toBe('株式会社サンプル創立二十周年記念パーティー懇親会');
  });
  it('1文節なら wbr なし', () => expect(renderToStaticMarkup(<Phrase text="同窓会" />)).toBe('<span class="phrase">同窓会</span>'));
});
