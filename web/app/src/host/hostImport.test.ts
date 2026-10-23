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
