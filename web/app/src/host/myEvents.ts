/** この端末で作った（または管理用リンクで開いた）イベントの記録。ログインなしの試作用 */
export interface MyEvent { id: string; name: string; createdAt: string }
const KEY = 'ec.myEvents';

export function loadMyEvents(): MyEvent[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter((e): e is MyEvent => e && typeof e.id === 'string')
      .map((e) => ({ id: e.id, name: String(e.name ?? ''), createdAt: String(e.createdAt ?? '') }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 新しい順
  } catch { return []; }
}

function save(list: MyEvent[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* noop */ }
}

/** 追加または更新。既にある場合は作成日時を保ち、空でない名前だけ上書きする */
export function upsertMyEvent(e: { id: string; name?: string; createdAt?: string }) {
  const list = loadMyEvents();
  const cur = list.find((x) => x.id === e.id);
  if (cur) {
    if (e.name) cur.name = e.name;
    save(list);
  } else {
    list.push({ id: e.id, name: e.name ?? '', createdAt: e.createdAt ?? new Date().toISOString() });
    save(list);
  }
}

/** この端末の一覧から外す（サーバーのデータは消さない） */
export function removeMyEvent(id: string) {
  save(loadMyEvents().filter((e) => e.id !== id));
}
