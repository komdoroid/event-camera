import { SAMPLE_DIARIES } from '../lib/samples';

export type BackTarget = { type: 'history' } | { type: 'path'; path: string };

/** アルバムの「もどる」の行き先。アプリ内の履歴 → ホスト管理 → サンプルならマイイベント → ゲストの「とどきました」 */
export function backTarget(o: { eventId: string; locationKey: string; hasHostToken: boolean; samples?: { id: string }[] }): BackTarget {
  if (o.locationKey !== 'default') return { type: 'history' };
  if (o.hasHostToken) return { type: 'path', path: `/host/${o.eventId}` };
  if ((o.samples ?? SAMPLE_DIARIES).some((s) => s.id === o.eventId)) return { type: 'path', path: '/host' };
  return { type: 'path', path: `/e/${o.eventId}` };
}
