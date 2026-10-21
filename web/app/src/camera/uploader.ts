import { api as defaultApi, ApiError, type Api } from '../api';

export interface UploadJob { eventId: string; guestId: string; blob: Blob }
type Fail = (reason: 'limit' | 'closed' | 'failed') => void;

const RETRIES = 3;
const defaultSleep = (n: number) => new Promise<void>((r) => setTimeout(r, 600 * 2 ** n));

async function retry<T>(fn: () => Promise<T>, sleep: (n: number) => Promise<void>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      // 409/403 はやり直しても無駄
      if (e instanceof ApiError && (e.status === 409 || e.status === 403)) throw e;
      if (i >= RETRIES - 1) throw e;
      await sleep(i);
    }
  }
}

/** POST /shots → PUT uploadUrl の順に1枚送る */
export async function uploadShot(job: UploadJob, api: Api = defaultApi, sleep = defaultSleep): Promise<void> {
  const ticket = await retry(() => api.createShot(job.eventId, job.guestId), sleep);
  await retry(() => api.uploadPhoto(ticket.uploadUrl, job.blob), sleep);
}

// 撮影を止めないバックグラウンドキュー（画面遷移しても続く）
let chain: Promise<void> = Promise.resolve();
let pending = 0;
export const pendingUploads = () => pending;

export function enqueue(job: UploadJob, onFail: Fail): void {
  pending++;
  chain = chain.then(async () => {
    try {
      await uploadShot(job);
    } catch (e) {
      const s = e instanceof ApiError ? e.status : 0;
      onFail(s === 409 ? 'limit' : s === 403 ? 'closed' : 'failed');
    } finally {
      pending--;
    }
  });
}
