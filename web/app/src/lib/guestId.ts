const KEY = 'ec.guestId';
let memory: string | null = null;

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

/** 端末ごとの UUID。localStorage が使えない場合はメモリ上のみ */
export function getGuestId(): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return v;
    const id = newId();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return (memory ??= newId());
  }
}
