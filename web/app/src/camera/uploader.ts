import { api as defaultApi, ApiError, type Api } from '../api';

export interface UploadJob { eventId: string; guestId: string; blob: Blob }
export type FailReason = 'limit' | 'closed' | 'expired';

interface Item {
  job: UploadJob;
  onFail: (r: FailReason) => void;
  seq: number;
  attempt: number;
  nextAt: number;
  ticket?: { uploadUrl: string; expiresAt: number };
}

export interface QueueOptions {
  delays?: number[]; // 失敗後の再試行間隔(ms)。最後の値を繰り返す
  now?: () => number;
}

/**
 * 撮影を止めないバックグラウンドのアップロードキュー。
 * 成功するまで blob を保持し、間隔をあけて再試行する。
 * 署名URLの期限が切れたものは失敗として通知する（枠の再発行はできないため）。
 */
export class UploadQueue {
  private items: Item[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private seq = 0;
  private delays: number[];
  private now: () => number;

  constructor(private api: Api, opts: QueueOptions = {}) {
    this.delays = opts.delays ?? [2000, 5000, 15000, 30000];
    this.now = opts.now ?? Date.now;
  }

  get pending() { return this.items.length; }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit() { this.listeners.forEach((f) => f()); }

  enqueue(job: UploadJob, onFail: (r: FailReason) => void) {
    this.items.push({ job, onFail, seq: this.seq++, attempt: 0, nextAt: 0 });
    this.emit();
    this.wake();
  }

  /** 待ち時間を飛ばしてすぐ再開する（online イベントなど） */
  wake() {
    clearTimeout(this.timer);
    for (const it of this.items) it.nextAt = 0;
    void this.pump();
  }

  private remove(it: Item) { this.items = this.items.filter((x) => x !== it); this.emit(); }
  private retryLater(it: Item) {
    it.nextAt = this.now() + this.delays[Math.min(it.attempt, this.delays.length - 1)];
    it.attempt++;
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const now = this.now();
        const due = this.items
          .filter((i) => i.nextAt <= now)
          // 期限が近い署名URLを優先、次に撮影順
          .sort((a, b) => (a.ticket?.expiresAt ?? Infinity) - (b.ticket?.expiresAt ?? Infinity) || a.seq - b.seq);
        if (due.length === 0) {
          if (this.items.length) {
            const next = Math.min(...this.items.map((i) => i.nextAt));
            this.timer = setTimeout(() => void this.pump(), Math.max(0, next - now));
          }
          return;
        }
        await this.step(due[0]);
      }
    } finally {
      this.running = false;
    }
  }

  private async step(it: Item) {
    try {
      if (!it.ticket) {
        const t = await this.api.createShot(it.job.eventId, it.job.guestId);
        it.ticket = { uploadUrl: t.uploadUrl, expiresAt: Date.parse(t.expiresAt) || this.now() + 10 * 60 * 1000 };
      }
      if (this.now() >= it.ticket.expiresAt - 1000) { this.remove(it); it.onFail('expired'); return; }
      await this.api.uploadPhoto(it.ticket.uploadUrl, it.job.blob);
      this.remove(it);
    } catch (e) {
      const s = e instanceof ApiError ? e.status : 0;
      if (!it.ticket) {
        if (s === 409) { this.remove(it); it.onFail('limit'); return; }
        if (s === 403) { this.remove(it); it.onFail('closed'); return; }
      } else {
        if (s === 409) { this.remove(it); return; } // 保存済み
        if (s === 403 || s === 410) { this.remove(it); it.onFail('expired'); return; }
      }
      this.retryLater(it); // 通信エラーなど: blob を残して再試行
    }
  }
}

export const uploadQueue = new UploadQueue(defaultApi);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => uploadQueue.wake());
  // 送信待ちの写真がある間は、離脱の前に警告する
  window.addEventListener('beforeunload', (e) => {
    if (uploadQueue.pending > 0) { e.preventDefault(); e.returnValue = ''; }
  });
}
