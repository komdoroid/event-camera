import { describe, expect, it } from 'vitest';
import { parseImportPayload } from './hostImport';

const enc = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');

describe('parseImportPayload', () => {
  it('日本語を含む配列を読める', () => {
    const r = parseImportPayload(enc([{ id: 'a', t: 'tk', name: '結婚式', createdAt: '2025-05-01T00:00:00Z' }, { id: 'b', t: 'x', name: 'B', createdAt: '2025-06-01T00:00:00Z' }]));
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ id: 'a', t: 'tk', name: '結婚式', createdAt: '2025-05-01T00:00:00Z' });
  });
  it('不正な値は無視する', () => {
    expect(parseImportPayload('!!!')).toEqual([]);
    expect(parseImportPayload(enc({ a: 1 }))).toEqual([]);
    expect(parseImportPayload(enc([{ id: 'a' }, null, { id: 'b', t: 'k' }]))).toEqual([{ id: 'b', t: 'k', name: '', createdAt: '' }]);
  });
});

import { cleanInput, parseLinkInput } from './hostImport';

describe('parseLinkInput', () => {
  const items = [{ id: 'a', t: 'tk', name: '結婚式', createdAt: '2025-05-01T00:00:00Z' }];
  const payload = enc(items);
  it('取り込みリンク', () => {
    expect(parseLinkInput(`https://x.pages.dev/host#import=${payload}`)).toEqual({ kind: 'import', items });
  });
  it('途中に改行・空白が入っていても読める', () => {
    const cut = `https://x.pages.dev/host#import=${payload.slice(0, 10)}\n  ${payload.slice(10, 20)} \r\n${payload.slice(20)}`;
    expect(parseLinkInput(cut)).toEqual({ kind: 'import', items });
    expect(parseLinkInput(`https://x.pages.dev/host#import=${payload.slice(0, 7)}%0A${payload.slice(7)}`)).toEqual({ kind: 'import', items });
  });
  it('%23 でも読める', () => {
    expect(parseLinkInput(`https://x/host%23import=${payload}`)).toEqual({ kind: 'import', items });
  });
  it('ペイロード単体', () => {
    expect(parseLinkInput(` ${payload}\n`)).toEqual({ kind: 'import', items });
  });
  it('管理用リンク', () => {
    expect(parseLinkInput('https://x.pages.dev/host/ev1#t=abc%2Fd')).toEqual({ kind: 'token', id: 'ev1', t: 'abc/d' });
    expect(parseLinkInput('https://x.pages.dev/host/ev1#t=ab\n c')).toEqual({ kind: 'token', id: 'ev1', t: 'abc' });
  });
  it('不正な入力', () => {
    for (const s of ['', '   \n', 'hello world', 'https://example.com/', '#import=!!!', `#import=${enc({ a: 1 })}`]) {
      expect(parseLinkInput(s)).toEqual({ kind: 'invalid' });
    }
  });
});

describe('cleanInput', () => {
  it('空白・改行・エンコード済み改行を消す', () => {
    expect(cleanInput('a b\nc%0Ad%20e%0d')).toBe('abcde');
  });
});
