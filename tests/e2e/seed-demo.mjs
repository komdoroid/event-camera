// 本番(または API_BASE)にデモ用の過去イベントを作る。実行は1回だけ（再実行するとイベントが重複する）。
// 使い方: node e2e/seed-demo.mjs <画像ディレクトリ> [出力リンクのファイル]
//   画像ディレクトリ: wedding-*.jpg / birthday-*.jpg / bbq-*.jpg / reunion-*.jpg
//   出力: 取り込み用リンク(ホストの鍵を含む)。リポジトリには置かないこと。
import { readdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const API_BASE = process.env.API_BASE || "https://event-camera-api.kom-commoc.workers.dev";
const WEB_BASE = process.env.WEB_BASE || "https://event-camera.kom-commoc.workers.dev";
const dir = process.argv[2];
const outFile = process.argv[3];
if (!dir) { console.error("usage: node e2e/seed-demo.mjs <image-dir> [link-out-file]"); process.exit(2); }
const J = { "Content-Type": "application/json" };

const EVENTS = [
  { prefix: "wedding", name: "ウェディングパーティー", createdAt: "2026-09-14T10:00:00+09:00", publish: true, guests: 5 },
  { prefix: "birthday", name: "誕生日パーティー", createdAt: "2026-08-02T10:00:00+09:00", publish: true, guests: 4 },
  { prefix: "bbq", name: "ガーデンBBQ", createdAt: "2026-06-21T10:00:00+09:00", publish: true, guests: 4 },
  { prefix: "reunion", name: "同窓会", createdAt: "2026-10-18T10:00:00+09:00", publish: false, guests: 3 },
];

async function api(path, init) {
  const r = await fetch(API_BASE + path, init);
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
const must = (r, ok, what) => { if (r.status !== ok) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`); return r.body; };

const files = (await readdir(dir)).filter((f) => /\.jpe?g$/i.test(f)).sort();
const imported = [];
let ng = 0;
for (const ev of EVENTS) {
  const imgs = files.filter((f) => f.startsWith(ev.prefix + "-"));
  const made = must(await api("/api/events", { method: "POST", headers: J, body: JSON.stringify({ name: ev.name, shotLimit: 27 }) }), 201, "create event");
  const guests = Array.from({ length: ev.guests }, () => randomUUID());
  for (let i = 0; i < imgs.length; i++) {
    const guestId = guests[i % guests.length];
    const s = must(await api(`/api/events/${made.id}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId }) }), 201, "shot");
    const put = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: await readFile(join(dir, imgs[i])) });
    if (put.status !== 204) throw new Error(`PUT ${imgs[i]}: ${put.status}`);
  }
  if (ev.publish) must(await api(`/api/events/${made.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${made.hostToken}` } }), 200, "publish");
  imported.push({ id: made.id, t: made.hostToken, name: ev.name, createdAt: ev.createdAt });

  // 確認
  const info = must(await api(`/api/events/${made.id}`), 200, "get event");
  const want = ev.publish ? "published" : "shooting";
  let ok = info.status === want && info.stats.photos === imgs.length && info.stats.uploaded === imgs.length;
  let extra = "";
  if (ev.publish) {
    const al = await api(`/api/events/${made.id}/album`);
    const pages = al.body?.pages?.length ?? 0;
    ok = ok && al.status === 200 && pages > 0;
    extra = ` album=${al.status} pages=${pages}`;
  }
  if (!ok) ng++;
  console.log(`${ok ? "OK " : "NG "} ${ev.name} id=${made.id} status=${info.status} photos=${info.stats.photos} uploaded=${info.stats.uploaded} guests=${info.stats.guests}${extra}`);
}

const payload = Buffer.from(JSON.stringify(imported), "utf8").toString("base64url");
const link = `${WEB_BASE}/host#import=${payload}`;
if (outFile) { await writeFile(outFile, link + "\n", { mode: 0o600 }); console.log("import link saved to", outFile); }
else console.log("import link:", link);
process.exit(ng ? 1 : 0);
