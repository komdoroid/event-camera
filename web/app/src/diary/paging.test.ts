// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clampPage, countMine, loadPurchased, printPageCount, savePurchased, swipeDir, totalPages, visiblePages } from './paging';
import { COPY, copyFor } from './copy';

const ph = (id: string, mine?: boolean) => ({ id, url: '', takenAt: '', mine });
const pages = [
  { layout: 'cover', photos: [ph('a')] },
  { layout: 'full', photos: [ph('b', true)] },
  { layout: 'duo', photos: [] },
  { layout: 'grid', photos: [ph('c', true), ph('d', false)] },
];

describe('copyFor', () => {
  it('uses the shared title unless wedding', () => {
    expect(copyFor('other').albumTitle.join('')).toBe('みんなの絵日記');
    expect(copyFor(undefined).albumTitle.join('')).toBe('みんなの絵日記');
    expect(copyFor('birthday').albumTitle.join('')).toBe('みんなの絵日記');
    expect(copyFor('wedding').albumTitle.join('')).toBe('ふたりの絵日記');
  });
  it('swaps memos by kind and falls back', () => {
    expect(copyFor('trip').pageMemos).not.toEqual(COPY.pageMemos);
    expect(copyFor('other').pageMemos).toEqual(COPY.pageMemos);
  });
  it('has no wedding wording outside wedding', () => {
    for (const k of ['birthday', 'party', 'reunion', 'trip', 'company', 'other'] as const) {
      expect(JSON.stringify(copyFor(k))).not.toContain('ふたり');
    }
  });
});

describe('paging', () => {
  it('drops empty pages and adds the end page', () => {
    expect(visiblePages(pages)).toHaveLength(3);
    expect(totalPages(pages)).toBe(4);
  });
  it('clamps', () => { expect(clampPage(-1, 4)).toBe(0); expect(clampPage(9, 4)).toBe(3); });
  it('counts mine', () => expect(countMine(pages)).toBe(2));
  it('print page count is even', () => expect(printPageCount(pages)).toBe(4));
  it('swipe direction', () => {
    expect(swipeDir(-80, 5)).toBe(1);
    expect(swipeDir(80, 5)).toBe(-1);
    expect(swipeDir(20, 0)).toBeNull();
    expect(swipeDir(-80, 90)).toBeNull();
  });
});

describe('purchased', () => {
  beforeEach(() => localStorage.clear());
  it('stores per event', () => {
    expect(loadPurchased('e1')).toEqual([]);
    savePurchased('e1', 'digital');
    savePurchased('e1', 'digital');
    savePurchased('e1', 'print');
    expect(loadPurchased('e1')).toEqual(['digital', 'print']);
    expect(loadPurchased('e2')).toEqual([]);
  });
});
