// T28: アルバムの「もどる」ボタン。実 API(:8787) + 実 API 向けの web(:5173)。ローカルのみ。
// サンプルID(09397db3 など)は本番にしかないので、ローカルでは album の応答を差し替えて確かめる。
import { chromium } from "playwright";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const J = { "Content-Type": "application/json" };
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
let ng = 0;
const out = (n, ok, d = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${n}${d ? " : " + d : ""}`); };
const sec = async (name, fn) => { console.log(`--- ${name}`); try { await fn(); } catch (e) { ng++; console.log(`NG  [${name}] 途中で失敗: ${String(e.message).split("\n")[0]}`); } };
const browser = await chromium.launch();
const errors = [];
const SAMPLE = "09397db3";
const JPG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
const mkEv = async (b) => (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify(b) })).json();
const shot = async (eid, g) => { const s = await (await fetch(`${API}/events/${eid}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId: g }) })).json(); await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPG }); };
const publish = (e) => fetch(`${API}/events/${e.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${e.hostToken}` } });
async function mk(o = {}) {
  const c = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await c.addInitScript((o) => { try { localStorage.setItem("ec.introSeen", "1"); localStorage.setItem("ec.installShown", "1"); if (o.guestId) localStorage.setItem("ec.guestId", o.guestId); for (const [id, t] of o.tokens ?? []) localStorage.setItem(`ec.hostToken.${id}`, t); } catch {} }, o);
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(`${m.text()} @ ${m.location().url || p.url()}`); });
  p.on("pageerror", (e) => errors.push("pageerror " + e.message));
  if (o.sample) await p.route(`**/api/events/${SAMPLE}/album*`, (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o.sample) }));
  return p;
}
const path = (p) => new URL(p.url()).pathname;
const noH = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll(".diary,.dpage")].every((e) => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).overflowX === "hidden"));
// ボタンが見える・押せる（他の要素に覆われていない）・十分な大きさ
const btnInfo = (p) => p.evaluate(() => {
  const b = document.querySelector(".backbtn"); if (!b) return null;
  const r = b.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return { x: r.left, y: r.top, w: r.width, h: r.height, vis: r.width > 0 && getComputedStyle(b).visibility !== "hidden", inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, tappable: hit === b || b.contains(hit), count: document.querySelectorAll(".backbtn").length };
});
const okBtn = async (p, label) => { const i = await btnInfo(p); out(`${label}: 「もどる」が見えて押せる（44px以上・覆われない・1つだけ）`, !!i && i.vis && i.inView && i.tappable && i.w >= 44 && i.h >= 44 && i.count === 1, JSON.stringify(i)); out(`${label}: 横スクロールなし`, await noH(p)); return i; };
const snap = async (p, n) => { await p.waitForTimeout(450); await p.screenshot({ path: `${SHOT}t28-${n}.png` }); };
const loaded = (p) => p.waitForFunction(() => { const h = document.querySelector("h1.evtitle"); return h && !h.textContent.includes("読み込み中"); });

// 準備: 現像済み(ホスト鍵あり) と 撮影中
const E = await mkEv({ name: "もどる確認", shotLimit: 27, kind: "party" });
for (let i = 0; i < 9; i++) await shot(E.id, `t28-guest-000${i % 3}`);
await publish(E);
const S = await mkEv({ name: "撮影中のまま", shotLimit: 27 }); await shot(S.id, "t28-guest-0001");
const album = await (await fetch(`${API}/events/${E.id}/album`)).json();
const sampleAlbum = { ...album, event: { ...album.event, id: SAMPLE, name: "誕生日パーティー" } };

await sec("A ダッシュボード →「アルバムを見る」→ もどる → ダッシュボード", async () => {
  const p = await mk({ tokens: [[E.id, E.hostToken]] });
  await p.goto(`${WEB}/host/${E.id}`); await p.waitForSelector(".stage a.shoot"); await loaded(p);
  await p.click(".stage a.shoot:has-text('アルバムを見る')"); await p.waitForURL(`${WEB}/e/${E.id}/album`); await p.waitForSelector(".dpage.cover");
  await okBtn(p, "表紙");
  await p.click(".backbtn"); await p.waitForURL(`${WEB}/host/${E.id}`); await p.waitForSelector(".stage");
  out("A: もどる → /host/:id（ダッシュボード）", path(p) === `/host/${E.id}` && (await p.locator(".stage").count()) === 1);
  await p.close();
  // マイイベント → ダッシュボード → アルバム → もどる ×2
  const q = await mk({ tokens: [[E.id, E.hostToken]] });
  await q.goto(`${WEB}/host`); await q.evaluate(([id]) => localStorage.setItem("ec.myEvents", JSON.stringify([{ id, name: "もどる確認", createdAt: new Date().toISOString() }])), [E.id]);
  await q.goto(`${WEB}/host`); await q.waitForSelector(".evcard"); await q.click(".evmain");
  await q.waitForURL(`${WEB}/host/${E.id}`); await q.click(".stage a.shoot"); await q.waitForURL(/\/album$/); await q.waitForSelector(".dpage.cover");
  await q.click(".backbtn"); await q.waitForURL(`${WEB}/host/${E.id}`);
  await q.click(".hback"); await q.waitForSelector(".evcard");
  out("A: ダッシュボード → 戻る(画面の←) → 一覧 と履歴がずれない", path(q) === "/host");
  await q.close();
});

await sec("B 管理者の端末でアルバムURLを直接開く → /host/:id", async () => {
  const p = await mk({ tokens: [[E.id, E.hostToken]] });
  await p.goto(`${WEB}/e/${E.id}/album`); await p.waitForSelector(".dpage.cover");
  await p.click(".backbtn"); await p.waitForURL(`${WEB}/host/${E.id}`);
  out("B: 直接開いて もどる → /host/:id", path(p) === `/host/${E.id}`);
  await p.waitForSelector(".stage"); await p.goBack().catch(() => {});
  out("B: 履歴を置き換えている（ブラウザの戻るでアルバムに戻らず、ループしない）", !p.url().endsWith("/album"), p.url());
  await p.close();
});

await sec("C サンプルをマイイベントから開く → もどる → /host", async () => {
  const p = await mk({ sample: sampleAlbum });
  await p.goto(`${WEB}/host`); await p.waitForSelector(".empty .chip.sample");
  const hrefs = await p.locator(".empty .chip.sample").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
  out("C: サンプルのリンクに 09397db3 がある", hrefs.includes(`/e/${SAMPLE}/album`), hrefs.join());
  await p.click(`.empty .chip.sample[href='/e/${SAMPLE}/album']`); await p.waitForURL(`${WEB}/e/${SAMPLE}/album`); await p.waitForSelector(".dpage.cover");
  await okBtn(p, "サンプル表紙");
  await p.click(".backbtn"); await p.waitForURL(`${WEB}/host`); await p.waitForSelector(".empty");
  out("C: もどる → /host（一覧）", path(p) === "/host");
  await p.close();
  // 一覧(イベントあり)のサンプルリンクから
  const q = await mk({ sample: sampleAlbum, tokens: [[E.id, E.hostToken]] });
  await q.goto(`${WEB}/host`); await q.evaluate(([id]) => localStorage.setItem("ec.myEvents", JSON.stringify([{ id, name: "もどる確認", createdAt: new Date().toISOString() }])), [E.id]);
  await q.goto(`${WEB}/host`); await q.waitForSelector(".evcard"); await q.click(`.samples .chip.sample[href='/e/${SAMPLE}/album']`);
  await q.waitForURL(`${WEB}/e/${SAMPLE}/album`); await q.waitForSelector(".dpage.cover"); await q.click(".backbtn"); await q.waitForURL(`${WEB}/host`); await q.waitForSelector(".evcard");
  out("C: 一覧のサンプルから → もどる → 一覧", path(q) === "/host" && (await q.locator(".evcard").count()) === 1);
  await q.close();
});

await sec("D 鍵なしの端末でサンプルURLを直接開く → /host", async () => {
  const p = await mk({ sample: sampleAlbum });
  await p.goto(`${WEB}/e/${SAMPLE}/album`); await p.waitForSelector(".dpage.cover");
  await p.click(".backbtn"); await p.waitForURL(`${WEB}/host`);
  out("D: サンプルを直接 → もどる → /host", path(p) === "/host");
  await p.close();
});

await sec("E ゲストがアルバムURLを直接開く → 「とどきました」", async () => {
  const p = await mk({ guestId: "t28-guest-0001" });
  await p.goto(`${WEB}/e/${E.id}/album`); await p.waitForSelector(".dpage.cover");
  await p.click(".backbtn"); await p.waitForURL(`${WEB}/e/${E.id}`); await p.waitForSelector("text=ひらく");
  out("E: もどる → /e/:id の「とどきました」", path(p) === `/e/${E.id}` && (await p.locator("body").innerText()).includes("とどきました"));
  out("E: 管理画面へのリンクなど鍵のない端末に余計な表示がない", (await p.locator("a.hostback").count()) === 0);
  await p.click("text=ひらく"); await p.waitForSelector(".dpage.cover");
  await p.click(".backbtn"); await p.waitForURL(`${WEB}/e/${E.id}`);
  out("E: 「ひらく」で入ってから もどる → /e/:id（履歴どおり）", path(p) === `/e/${E.id}`);
  await p.close();
});

await sec("F すべてのページ・購入・完了・現像前で「もどる」が使える（375px）", async () => {
  const p = await mk({ guestId: "t28-guest-0001" });
  await p.goto(`${WEB}/e/${E.id}/album`); await p.waitForSelector(".dpage.cover"); await p.waitForTimeout(500);
  const total = Number((await p.locator(".pn").innerText()).split("/")[1]);
  for (let i = 0; i < total; i++) {
    const lbl = i === 0 ? "表紙" : i === total - 1 ? "最後のページ" : `ページ${i + 1}`;
    const info = await btnInfo(p);
    out(`${lbl}: 「もどる」が見えて押せる`, !!info && info.vis && info.inView && info.tappable && info.w >= 44 && info.h >= 44 && info.count === 1, JSON.stringify(info));
    if (i === 0) {
      const ov = await p.evaluate(() => { const b = document.querySelector(".backbtn").getBoundingClientRect(); const h = document.querySelector(".dpage.cover h1").getBoundingClientRect(); return { b: [b.left, b.top, b.right, b.bottom].map(Math.round), h: [h.left, h.top, h.right, h.bottom].map(Math.round), overlap: b.left < h.right && b.right > h.left && b.top < h.bottom && b.bottom > h.top }; });
      out("表紙: 「もどる」が題名（見出し）に重ならない", !ov.overlap, JSON.stringify(ov));
      await snap(p, "cover");
    }
    if (i === 1) await snap(p, "page");
    if (i < total - 1) { await p.click(".pager button:has-text('つぎ')"); await p.waitForTimeout(80); }
  }
  out("全ページ 横スクロールなし", await noH(p));
  await snap(p, "end");
  await p.click(".dpage.end >> text=えらぶ"); await p.waitForSelector(".buy"); await okBtn(p, "購入シート"); await snap(p, "buy");
  await p.locator(".buy .hcard button.pri").click(); await p.waitForSelector(".donep"); await okBtn(p, "完了画面"); await snap(p, "done");
  const donePic = await p.evaluate(() => { const b = document.querySelector(".backbtn").getBoundingClientRect(); const h = document.querySelector(".donep h1").getBoundingClientRect(); return b.bottom <= h.top || b.left >= h.right || b.right <= h.left; });
  out("完了画面: 「もどる」が見出しに重ならない", donePic);
  // 購入シート/完了でもどる → ブラウザ履歴へ（アルバムを閉じる）
  await p.click(".backbtn"); await p.waitForTimeout(500);
  out("完了画面の「もどる」はアルバムから出る（履歴がなければ /e/:id）", !path(p).endsWith("/album"), path(p));
  await p.close();
  // 現像前
  const q = await mk({ tokens: [[S.id, S.hostToken]] });
  await q.goto(`${WEB}/e/${S.id}/album`); await q.waitForSelector("text=まだ現像前です");
  await okBtn(q, "現像前");
  out("現像前: 「もどる」リンクは1つだけ（古い「もどる」リンクは削除済み）", (await q.locator("text=もどる").count()) === 1 && (await q.locator(".dpage.screen a").count()) === 0, `${await q.locator("text=もどる").count()}`);
  await snap(q, "not-yet");
  await q.click(".backbtn"); await q.waitForURL(`${WEB}/host/${S.id}`);
  out("現像前(ホスト端末): もどる → /host/:id", path(q) === `/host/${S.id}`);
  await q.close();
  const g = await mk({ guestId: "t28-guest-0001" });
  await g.goto(`${WEB}/e/${S.id}/album`); await g.waitForSelector("text=まだ現像前です"); await g.click(".backbtn"); await g.waitForURL(`${WEB}/e/${S.id}`);
  await g.waitForSelector(".welcome-ov, .cam, .start");
  out("現像前(ゲスト): もどる → /e/:id（撮影画面）", path(g) === `/e/${S.id}`);
  await g.close();
  // 読み込み失敗（存在しない ID）
  const x = await mk(); await x.goto(`${WEB}/e/ffffffff/album`); await x.waitForSelector(".errtxt");
  await okBtn(x, "読み込み失敗"); await x.click(".backbtn"); await x.waitForURL(`${WEB}/e/ffffffff`);
  out("読み込み失敗: もどる → /e/:id", path(x) === "/e/ffffffff");
  await x.close();
});

out("コンソールエラーなし（想定した 404 を除く）", errors.filter((e) => !/404|403|Failed to load resource/.test(e)).length === 0, [...new Set(errors)].slice(0, 4).join(" | "));
await browser.close();
console.log(ng ? `${ng} 件 NG` : "ALL OK");
process.exit(ng ? 1 : 0);
