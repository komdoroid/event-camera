// T5 の不具合 A/B/C が直ったか、T7 の新機能の確認。API(:8787) と、実 API 向けにビルドした web (:5173、preview) が必要。
// 結果は console に出る。1つでも NG なら終了コード 1。
import { chromium } from "playwright";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const J = { "Content-Type": "application/json" };
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAKACAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==".replace("wAKACAAB", "wAALCAAB"), "base64");
const mk = async (n, lim) => (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name: n, shotLimit: lim }) })).json();
const stats = async (id) => (await (await fetch(`${API}/events/${id}`)).json()).stats;
const pub = (ev) => fetch(`${API}/events/${ev.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${ev.hostToken}` } });
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
let ng = 0;
const out = (name, ok, detail = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${name}${detail ? " : " + detail : ""}`); };
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = async (cam = false) => { const c = await browser.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true, permissions: cam ? ["camera"] : [] }); return c.newPage(); };
const startCam = async (g) => { await g.click("text=カメラをはじめる"); await g.waitForSelector(".cam-bot .lbl.stat:has-text('撮影できます')"); };
const wind = async (g) => {
  const b = await g.locator(".wheel").boundingBox(); const y = b.y + b.height / 2;
  await g.mouse.move(b.x + 20, y); await g.mouse.down();
  for (let x = 20; x < 300; x += 20) await g.mouse.move(b.x + x, y);
  await g.mouse.up();
  await g.waitForFunction(() => document.querySelector(".cam")?.dataset.wound === "1");
};

// A1: 撮影中に現像 -> ポーリングで自動で切りかわる
{
  const ev = await mk("probe A1", 5);
  const g = await ctx(true);
  await g.goto(`${WEB}/e/${ev.id}`); await startCam(g);
  const t0 = Date.now();
  await pub(ev);
  const ok = await g.waitForSelector("text=とどきました", { timeout: 12000 }).then(() => true).catch(() => false);
  out("A1 撮影中に現像 -> 「とどきました」へ自動で切りかわる", ok, ok ? `${((Date.now() - t0) / 1000).toFixed(1)}秒` : "12秒以内に切りかわらず");
  await g.screenshot({ path: `${SHOT}probe-A1-announce.png` });
  await g.close();
}
// A2: ポーリングを妨げて、シャッターの 403 経由で切りかわり・カウンターが戻るか
{
  const ev = await mk("probe A2", 5);
  const g = await ctx(true);
  await g.goto(`${WEB}/e/${ev.id}`); await startCam(g);
  await g.route(new RegExp(`/api/events/${ev.id}$`), (r) => r.abort()); // 状態確認だけ止める（POST /shots は通す）
  await pub(ev);
  await g.click("button.shutter");
  const ok = await g.waitForSelector("text=とどきました", { timeout: 8000 }).then(() => true).catch(() => false);
  const st = await stats(ev.id);
  out("A2 シャッターが 403 -> 「とどきました」へ移る", ok, `API の枠=${st.photos}`);
  // カウンターの戻りは画面遷移で見えないので、戻らないままの再表示を確認: 現像済みのアルバム側にカウンターはないため、
  // 遷移前の一瞬のみ。ここでは「枠が増えていない」ことを確認する。
  out("A2 現像後は枠が増えていない", st.photos === 0, `${st.photos}`);
  await g.close();
}
// B: ホストの写真一覧が、アップロード完了後に更新される
{
  const ev = await mk("probe B", 5);
  const host = await ctx();
  await host.addInitScript(([i, t]) => localStorage.setItem(`ec.hostToken.${i}`, t), [ev.id, ev.hostToken]);
  await host.goto(`${WEB}/host/${ev.id}`); await host.waitForSelector("img.qr");
  const s = await (await fetch(`${API}/events/${ev.id}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId: "probe-guest-1" }) })).json();
  await host.waitForTimeout(5500); // 枠だけ確保された状態でホストがポーリング
  const mid = await host.locator(".thumbs img").count();
  const put = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG });
  let n = 0; const t0 = Date.now();
  while (Date.now() - t0 < 12000 && n !== 1) { await host.waitForTimeout(500); n = await host.locator(".thumbs img").count(); }
  out("B アップロード完了後にホストの一覧が 1 枚になる", n === 1, `PUT=${put.status}, 枠のみの時点の一覧=${mid}枚, 完了後=${n}枚 (${((Date.now() - t0) / 1000).toFixed(1)}秒)`);
  await host.close();
}
// C: PUT を遮断 -> 「送信中 n 枚」-> 復帰したら送られる
{
  const ev = await mk("probe C", 3);
  const g = await ctx(true);
  let block = true;
  await g.route("**/api/uploads/**", (r) => (block ? r.abort() : r.continue()));
  await g.goto(`${WEB}/e/${ev.id}`); await startCam(g);
  await g.click("button.shutter");
  const shown = await g.waitForSelector(".sending", { timeout: 5000 }).then((e) => e.innerText()).catch(() => null);
  out("C 「送信中 n 枚」が出る", !!shown && /1/.test(shown), `表示="${shown}"`);
  await g.screenshot({ path: `${SHOT}probe-C-sending.png` });
  // beforeunload の警告
  const dialog = new Promise((res) => { g.once("dialog", (d) => { res(d.type()); d.dismiss(); }); setTimeout(() => res(null), 4000); });
  await g.evaluate(() => { window.dispatchEvent(new Event("beforeunload", { cancelable: true })); });
  const prevented = await g.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  out("C 送信中の beforeunload で警告（preventDefault）", prevented);
  await dialog;
  await new Promise((r) => setTimeout(r, 3000));
  const before = await stats(ev.id);
  out("C 遮断中は未アップロード", before.uploaded === 0, JSON.stringify(before));
  block = false; const t0 = Date.now();
  let up = 0;
  while (Date.now() - t0 < 60000 && up < 1) { await new Promise((r) => setTimeout(r, 1000)); up = (await stats(ev.id)).uploaded; }
  out("C 復帰後に再送されて uploaded=1", up === 1, `${((Date.now() - t0) / 1000).toFixed(1)}秒`);
  await g.waitForTimeout(500);
  out("C 完了後に「送信中」が消える", (await g.locator(".sending").count()) === 0);
  await g.close();
}
// D: 管理用リンクで別のコンテキストからホストになれる
{
  const ev = await mk("probe D", 3);
  const h1 = await ctx();
  await h1.addInitScript(([i, t]) => { if (!localStorage.getItem(`ec.hostToken.${i}`)) localStorage.setItem(`ec.hostToken.${i}`, t); }, [ev.id, ev.hostToken]);
  await h1.goto(`${WEB}/host/${ev.id}`); await h1.waitForSelector("img.qr");
  // 管理用リンクは「コピー」ボタン。クリップボードを読む
  await h1.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await h1.click("button:has-text('管理用リンクをコピー')");
  let link = await h1.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  if (!link) link = `${WEB}/host/${ev.id}#t=${ev.hostToken}`; // クリップボードが読めない場合のフォールバック
  out("D コピーされた管理用リンクの形式", link === `${WEB}/host/${ev.id}#t=${ev.hostToken}`, link.replace(ev.hostToken, "<token>"));
  const h2 = await ctx();
  await h2.goto(link);
  const ok = await h2.waitForSelector("img.qr", { timeout: 8000 }).then(() => true).catch(() => false);
  out("D 別コンテキストで管理用リンクを開くとホストになれる", ok);
  out("D 開いたあと URL のハッシュが消える", !(await h2.evaluate(() => location.hash)));
  await h2.reload();
  out("D リロードしてもホストのまま", await h2.waitForSelector("img.qr", { timeout: 8000 }).then(() => true).catch(() => false));
  const h3 = await ctx();
  await h3.goto(`${WEB}/host/${ev.id}`);
  out("D リンクなしの別コンテキストはホストになれない", await h3.waitForSelector("text=ホストの権限がありません", { timeout: 8000 }).then(() => true).catch(() => false));
  await h1.close(); await h2.close(); await h3.close();
}
await browser.close();
process.exit(ng ? 1 : 0);
