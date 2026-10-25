import { expect, it } from 'vitest';
import { backTarget } from './backTarget';

const base = { eventId: 'abc', locationKey: 'default', hasHostToken: false, samples: [{ id: 'smp' }] };
it('uses history when there is an in-app previous page', () => {
  expect(backTarget({ ...base, locationKey: 'k1', hasHostToken: true })).toEqual({ type: 'history' });
});
it('goes to the host dashboard with a host token', () => {
  expect(backTarget({ ...base, hasHostToken: true })).toEqual({ type: 'path', path: '/host/abc' });
});
it('goes to My events for samples', () => {
  expect(backTarget({ ...base, eventId: 'smp' })).toEqual({ type: 'path', path: '/host' });
});
it('goes to the guest arrival screen otherwise', () => {
  expect(backTarget(base)).toEqual({ type: 'path', path: '/e/abc' });
});
