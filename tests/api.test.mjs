// API 通しテスト。事前に `cd api && npx wrangler dev --local`（:8787）を起動しておく。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const BASE = process.env.API_BASE ?? "http://localhost:8787";
const A = `${BASE}/api`;
const ORIGIN = "http://localhost:5173";
// 最小の JPEG（SOI + EOI。中身は検証されない）
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

const j = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function createEvent(shotLimit = 27, name = "Test Wedding") {
  const r = await fetch(`${A}/events`, j({ name, shotLimit }));
  assert.equal(r.status, 201);
  return r.json();
}
let gc = 0;
const gid = () => `guest-${Date.now()}-${gc++}`;
async function shot(ev, guestId) {
  const r = await fetch(`${A}/events/${ev.id}/shots`, j({ guestId }));
  return { status: r.status, body: await r.json() };
}
async function put(url, body = JPEG, ct = "image/jpeg") {
  return fetch(url, { method: "PUT", headers: { "Content-Type": ct }, body });
}
async function shootAndUpload(ev, guestId, n) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const s = await shot(ev, guestId);
    assert.equal(s.status, 201);
    assert.equal((await put(s.body.uploadUrl)).status, 204);
    ids.push(s.body.photoId);
    await new Promise((r) => setTimeout(r, 3)); // takenAt の順序を安定させる
  }
  return ids;
}
const publish = (ev, token) => fetch(`${A}/events/${ev.id}/publish`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
const album = async (ev) => { const r = await fetch(`${A}/events/${ev.id}/album`); return { status: r.status, body: r.status === 200 ? await r.json() : null }; };

test("作成 -> 枠確保 -> PUT -> 残り枚数", async () => {
  const ev = await createEvent(3);
  assert.ok(ev.id && ev.hostToken);
  assert.equal(ev.shotLimit, 3);
  const g = gid();
  let r = await (await fetch(`${A}/events/${ev.id}/guests/${g}`)).json();
  assert.deepEqual(r, { taken: 0, remaining: 3 });
  const s = await shot(ev, g);
  assert.equal(s.status, 201);
  assert.equal(s.body.remaining, 2);
  assert.equal((await put(s.body.uploadUrl)).status, 204);
  r = await (await fetch(`${A}/events/${ev.id}/guests/${g}`)).json();
  assert.deepEqual(r, { taken: 1, remaining: 2 });
  const info = await (await fetch(`${A}/events/${ev.id}`)).json();
  assert.equal(info.status, "shooting");
  assert.deepEqual(info.stats, { guests: 1, photos: 1 });
});

test("作成の入力検証 (400)", async () => {
  assert.equal((await fetch(`${A}/events`, j({ name: "" }))).status, 400);
  assert.equal((await fetch(`${A}/events`, j({ name: "x", shotLimit: 0 }))).status, 400);
  assert.equal((await fetch(`${A}/events`, j({ name: "x", shotLimit: 1.5 }))).status, 400);
  assert.equal((await fetch(`${A}/events`, { method: "POST", body: "not json" })).status, 400);
  const d = await (await fetch(`${A}/events`, j({ name: "default" }))).json();
  assert.equal(d.shotLimit, 27);
  assert.equal((await fetch(`${A}/events/nope`)).status, 404);
});

test("上限で 409 / 不正な guestId は 400", async () => {
  const ev = await createEvent(2);
  const g = gid();
  assert.equal((await shot(ev, g)).status, 201);
  assert.equal((await shot(ev, g)).status, 201);
  assert.equal((await shot(ev, g)).status, 409);
  assert.equal((await shot(ev, gid())).status, 201); // 別ゲストは撮れる
  assert.equal((await shot(ev, "short")).status, 400);
});

test("同時リクエストで上限を超えない", async () => {
  const ev = await createEvent(3);
  const g = gid();
  const rs = await Promise.all(Array.from({ length: 8 }, () => shot(ev, g)));
  assert.equal(rs.filter((x) => x.status === 201).length, 3);
  assert.equal(rs.filter((x) => x.status === 409).length, 5);
});

test("現像前のアルバムは 403 / 現像はトークン必須", async () => {
  const ev = await createEvent(3);
  assert.equal((await album(ev)).status, 403);
  assert.equal((await publish(ev)).status, 401);
  assert.equal((await publish(ev, "wrong-token")).status, 401);
  assert.equal((await album(ev)).status, 403);
  const r = await publish(ev, ev.hostToken);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, "published");
  assert.ok(b.publishedAt);
  assert.equal((await publish(ev, ev.hostToken)).status, 200); // 冪等
  assert.equal((await album(ev)).status, 200);
});

test("アルバムが空でも 200 (pages=[])", async () => {
  const ev = await createEvent(3);
  await publish(ev, ev.hostToken);
  const a = await album(ev);
  assert.equal(a.status, 200);
  assert.deepEqual(a.body.pages, []);
});

// layout の期待値。cover + [duo(2), grid(4), full(1), grid(3)] 巡回。最後に1枚だけ残さない
const LAYOUT_CASES = [
  [1, ["cover"]],
  [2, ["cover", "full"]],
  [5, ["cover", "duo", "duo"]],
  [12, ["cover", "duo", "grid", "full", "duo", "duo"]], // 残り4枚は 3+1 にせず 2+2,
];
for (const [n, layouts] of LAYOUT_CASES) {
  test(`アルバムのページ構成: ${n}枚`, async () => {
    const ev = await createEvent(30);
    const ids = await shootAndUpload(ev, gid(), n);
    await publish(ev, ev.hostToken);
    const { body } = await album(ev);
    assert.deepEqual(body.pages.map((p) => p.layout), layouts);
    const flat = body.pages.flatMap((p) => p.photos.map((x) => x.id));
    assert.deepEqual(flat, ids, "撮影順に全枚数が過不足なく並ぶ");
    assert.equal(body.stats.photos, n);
    for (const p of body.pages) {
      const expect = { cover: 1, full: 1, duo: 2 }[p.layout];
      if (expect) assert.equal(p.photos.length, expect);
      else assert.ok(p.photos.length >= 3 && p.photos.length <= 4);
    }
  });
}

test("アップロードされなかった枠はアルバム・写真一覧に載らない", async () => {
  const ev = await createEvent(10);
  const g = gid();
  const ids = await shootAndUpload(ev, g, 2);
  const ghost = await shot(ev, g); // PUT しない
  assert.equal(ghost.status, 201);
  const [id3] = await shootAndUpload(ev, g, 1);
  await publish(ev, ev.hostToken);
  const { body } = await album(ev);
  const flat = body.pages.flatMap((p) => p.photos.map((x) => x.id));
  assert.deepEqual(flat, [...ids, id3]);
  assert.ok(!flat.includes(ghost.body.photoId));
  assert.equal(body.stats.photos, 3);
  // 枠としては数えられている
  const r = await (await fetch(`${A}/events/${ev.id}/guests/${g}`)).json();
  assert.equal(r.taken, 4);
  const pl = await fetch(`${A}/events/${ev.id}/photos`, { headers: { Authorization: `Bearer ${ev.hostToken}` } });
  assert.equal((await pl.json()).photos.length, 3);
  // 未アップロードの画像は 404
  assert.equal((await fetch(`${A}/photos/${ghost.body.photoId}`)).status, 404);
});

test("写真一覧はホストのみ（現像前でも可）", async () => {
  const ev = await createEvent(5);
  const g = gid();
  const [id] = await shootAndUpload(ev, g, 1);
  assert.equal((await fetch(`${A}/events/${ev.id}/photos`)).status, 401);
  const r = await fetch(`${A}/events/${ev.id}/photos`, { headers: { Authorization: `Bearer ${ev.hostToken}` } });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.photos[0].id, id);
  assert.equal(b.photos[0].guestId, g);
});

test("画像の取得: 現像前は token 必須、現像後は誰でも", async () => {
  const ev = await createEvent(5);
  const [id] = await shootAndUpload(ev, gid(), 1);
  const u = `${A}/photos/${id}`;
  assert.equal((await fetch(u)).status, 403);
  assert.equal((await fetch(`${u}?token=wrong`)).status, 403);
  const r = await fetch(`${u}?token=${ev.hostToken}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), JPEG);
  assert.equal((await fetch(u, { headers: { Authorization: `Bearer ${ev.hostToken}` } })).status, 200);
  await publish(ev, ev.hostToken);
  const r2 = await fetch(u);
  assert.equal(r2.status, 200);
  assert.deepEqual(Buffer.from(await r2.arrayBuffer()), JPEG);
  assert.equal((await fetch(`${A}/photos/does-not-exist`)).status, 404);
});

test("注文: 現像後 201 / 不正入力 400 / 現像前 403", async () => {
  const ev = await createEvent(3);
  const g = gid();
  const before = await fetch(`${A}/events/${ev.id}/orders`, j({ guestId: g, product: "digital" }));
  assert.equal(before.status, 403);
  await publish(ev, ev.hostToken);
  let r = await fetch(`${A}/events/${ev.id}/orders`, j({ guestId: g, product: "digital" }));
  assert.equal(r.status, 201);
  let b = await r.json();
  assert.equal(b.amount, 500);
  assert.equal(b.status, "paid_mock");
  r = await fetch(`${A}/events/${ev.id}/orders`, j({ guestId: g, product: "print" }));
  assert.equal(r.status, 201);
  assert.equal((await r.json()).amount, 3000);
  assert.equal((await fetch(`${A}/events/${ev.id}/orders`, j({ guestId: g, product: "gold" }))).status, 400);
  assert.equal((await fetch(`${A}/events/${ev.id}/orders`, j({ guestId: g, product: "toString" }))).status, 400);
  assert.equal((await fetch(`${A}/events/${ev.id}/orders`, j({ guestId: g }))).status, 400);
  assert.equal((await fetch(`${A}/events/${ev.id}/orders`, j({ guestId: "x", product: "digital" }))).status, 400);
});

test("現像後の枠の確保は 403", async () => {
  const ev = await createEvent(3);
  await publish(ev, ev.hostToken);
  assert.equal((await shot(ev, gid())).status, 403);
});

test("署名: 改ざん 403 / 期限切れ 410 / 種別・サイズ", async () => {
  const ev = await createEvent(10);
  const g = gid();
  const s = await shot(ev, g);
  const u = new URL(s.body.uploadUrl);
  const exp = u.searchParams.get("exp");
  const sig = u.searchParams.get("sig");
  const base = `${A}/uploads/${s.body.photoId}`;
  // 改ざん
  const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
  assert.equal((await put(`${base}?exp=${exp}&sig=${flipped}`)).status, 403);
  assert.equal((await put(`${base}?exp=${Number(exp) + 1000}&sig=${sig}`)).status, 403, "exp を延ばすと 403");
  assert.equal((await put(`${base}?exp=${exp}`)).status, 403, "sig なし");
  assert.equal((await put(`${base}`)).status, 403, "exp/sig なし");
  assert.equal((await put(`${A}/uploads/other-photo?exp=${exp}&sig=${sig}`)).status, 403, "別の photoId");
  // 期限切れ: .dev.vars のシークレットで正しい署名の過去 exp を作る
  const secret = readFileSync(new URL("../api/.dev.vars", import.meta.url), "utf8").match(/^UPLOAD_SIGNING_SECRET=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
  const past = Math.floor(Date.now() / 1000) - 5;
  const psig = createHmac("sha256", secret).update(`${s.body.photoId}.${past}`).digest("hex");
  assert.equal((await put(`${base}?exp=${past}&sig=${psig}`)).status, 410);
  // 画像以外 415
  assert.equal((await put(s.body.uploadUrl, "hello", "text/plain")).status, 415);
  // 本物はまだ通る
  assert.equal((await put(s.body.uploadUrl)).status, 204);
  // 10MB 超 413
  const s2 = await shot(ev, g);
  assert.equal((await put(s2.body.uploadUrl, Buffer.alloc(10 * 1024 * 1024 + 1))).status, 413);
});

test("CORS プリフライト (Origin: http://localhost:5173)", async () => {
  const pre = async (path, method, headers) => fetch(`${A}${path}`, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": headers } });
  let r = await pre("/uploads/abc", "PUT", "content-type");
  assert.ok(r.status === 204 || r.status === 200);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(r.headers.get("access-control-allow-methods"), /PUT/);
  assert.match(r.headers.get("access-control-allow-headers").toLowerCase(), /content-type/);
  r = await pre("/events/abc/publish", "POST", "authorization,content-type");
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(r.headers.get("access-control-allow-methods"), /POST/);
  assert.match(r.headers.get("access-control-allow-headers").toLowerCase(), /authorization/);
  // 実リクエストにも付く（エラー応答でも）
  const e = await fetch(`${A}/events/nope`, { headers: { Origin: ORIGIN } });
  assert.equal(e.status, 404);
  assert.equal(e.headers.get("access-control-allow-origin"), ORIGIN);
  // 許可外 Origin には付かない
  const x = await fetch(`${A}/events/nope`, { headers: { Origin: "http://evil.example" } });
  assert.equal(x.headers.get("access-control-allow-origin"), null);
});
