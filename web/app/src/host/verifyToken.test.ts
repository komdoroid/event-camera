import { describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
  api: { listPhotos: vi.fn(async (_id: string, t: string) => { if (t !== 'good') throw new Error('401'); return { photos: [] }; }) },
}));
import { verifyHostToken } from './hostImport';

describe('verifyHostToken', () => {
  it('有効なトークンは true、無効は false', async () => {
    expect(await verifyHostToken('e', 'good')).toBe(true);
    expect(await verifyHostToken('e', 'bad')).toBe(false);
  });
});
