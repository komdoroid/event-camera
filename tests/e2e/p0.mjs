// T22: 複数イベント向け P0（ホストの紹介・種類・段階・印刷・売れた数・表紙、ゲストのようこそ・権限案内・ページ送り・シール・購入）。
// 実 API(:8787) + 実 API 向けの web(:5173、vite preview)。ローカルのみ。最後の「本番の読み取り」だけ本番 API に GET する（何も作らない）。
import { chromium } from "playwright";
import { createRequire } from "node:module";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const PROD = "https://event-camera-api.kom-commoc.workers.dev/api";
const J = { "Content-Type": "application/json" };
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
let ng = 0;
const out = (n, ok, d = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${n}${d ? " : " + d : ""}`); };
const sec = async (name, fn) => { console.log(`--- ${name}`); try { await fn(); } catch (e) { ng++; console.log(`NG  [${name}] 途中で失敗: ${String(e.message).split("\n")[0]}`); } };

// 写真（見分けがつく色の JPEG。sharp が使えなければ 1px の JPEG）
const TINY = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
let sharp = null;
try { sharp = createRequire(import.meta.url)("../../web/app/node_modules/sharp"); } catch { /* 1px の JPEG で代用 */ }
const photo = async (i) => {
  if (!sharp) return TINY;
  const hues = ["#f4c7c3", "#a6d4e4", "#f7e4a0", "#c9e4b5", "#d9c3ee", "#f6d0a8"];
  return sharp({ create: { width: 640, height: 480, channels: 3, background: hues[i % hues.length] } }).jpeg({ quality: 70 }).toBuffer();
};

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
// opts: intro(既定: 見たことにする) install(既定: 出し済みにする) cam guestId ua share(false で navigator.share を消す) denyCamera
async function mk(o = {}) {
  const c = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: [...(o.cam ? ["camera"] : []), ...(o.clip ? ["clipboard-read", "clipboard-write"] : [])], ...(o.ua ? { userAgent: o.ua } : {}) });
  await c.addInitScript((o) => {
    try {
      if (!o.keepIntro) localStorage.setItem("ec.introSeen", "1");
      if (!o.keepInstall) localStorage.setItem("ec.installShown", "1");
      if (o.guestId) localStorage.setItem("ec.guestId", o.guestId);
    } catch {}
    if (o.share === false) { try { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); } catch {} }
    if (o.share === "stub") { navigator.share = async (d) => { window.__shared = d; }; }
    if (o.denyCamera) { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError")); }
  }, o);
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(`${m.text()}`); });
  p.on("pageerror", (e) => errors.push("pageerror " + e.message));
  return p;
}
const noH = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll(".host,.cam,.dialog,.welcome-ov,.intro,.hprint")].every((e) => e.scrollWidth <= e.clientWidth + 1));
const snap = async (p, n, h = true) => { await p.waitForTimeout(450); await p.screenshot({ path: `${SHOT}p0-${n}.png` }); if (h) out(`[${n}] 横スクロールなし`, await noH(p)); };
const mkEv = async (b) => (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify(b) })).json();
const shot = async (eid, guestId, i = 0) => { const s = await (await fetch(`${API}/events/${eid}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId }) })).json(); const r = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: await photo(i) }); if (r.status !== 204) throw new Error("PUT " + r.status); return s.photoId; };
const publish = (e) => fetch(`${API}/events/${e.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${e.hostToken}` } });
const auth = (e) => ({ headers: { Authorization: `Bearer ${e.hostToken}` } });
const addToken = (p, e) => p.evaluate(([id, t]) => localStorage.setItem(`ec.hostToken.${id}`, t), [e.id, e.hostToken]);
const h1 = (p) => p.locator("h1.evtitle").innerText().then((t) => t.trim());
const loaded = (p) => p.waitForFunction(() => { const h = document.querySelector("h1.evtitle"); return h && !h.textContent.includes("読み込み中"); });
const primaries = (p) => p.locator(".host-in .hbtn.ghost:visible").count();
const WEDDINGISH = /ふたり|新郎|新婦|披露宴/;
const goEnd = async (p) => { for (let i = 0; i < 40 && !(await p.locator(".dpage.end").count()); i++) { await p.click(".pager button:has-text('つぎ')"); await p.waitForTimeout(50); } };
const swipe = (p, dx) => p.evaluate((dx) => {
  const el = document.querySelector(".diary"); const mkT = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
  const s = dx < 0 ? 300 : 80, e = s + dx;
  el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [mkT(s)], changedTouches: [mkT(s)] }));
  el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [mkT(e)] }));
}, dx);

await sec("A API の検証（kind・message・coverPhotoId）", async () => {
  const post = (b) => fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify(b) });
  out("不正な kind は 400", (await post({ name: "x", kind: "funeral" })).status === 400);
  out("message が141字は 400、140字は 201", (await post({ name: "x", message: "あ".repeat(141) })).status === 400 && (await post({ name: "x", message: "あ".repeat(140) })).status === 201);
  out("message が文字列でない場合は 400", (await post({ name: "x", message: 5 })).status === 400);
  const d = await (await post({ name: "既定" })).json();
  const g = await (await fetch(`${API}/events/${d.id}`)).json();
  out("kind を省略すると other、message は null", g.kind === "other" && g.message === null, JSON.stringify({ k: g.kind, m: g.message }));
  await shot(d.id, "p0-cover-guest-0001", 0);
  const noKey = await (await fetch(`${API}/events/${d.id}`)).json();
  const key = await (await fetch(`${API}/events/${d.id}`, auth(d))).json();
  out("撮影中の coverPhotoId は鍵なしでは null、鍵ありなら写真ID", noKey.coverPhotoId === null && typeof key.coverPhotoId === "string", JSON.stringify({ noKey: noKey.coverPhotoId, key: key.coverPhotoId }));
  const badKey = await (await fetch(`${API}/events/${d.id}`, { headers: { Authorization: "Bearer wrong" } })).json();
  out("間違った鍵では sales も coverPhotoId も出ない", badKey.sales === undefined && badKey.coverPhotoId === null);
  const img = await fetch(`${API}/photos/${key.coverPhotoId}`);
  out("撮影中の表紙画像は鍵なしでは取れない（403）", img.status === 403 || img.status === 401, `${img.status}`);
  const img2 = await fetch(`${API}/photos/${key.coverPhotoId}`, auth(d));
  out("鍵ありなら取れる", img2.status === 200, `${img2.status}`);
});

// ================= ホスト =================
await sec("H1 はじめての紹介（3枚・スキップ）", async () => {
  const p = await mk({ keepIntro: true, keepInstall: true });
  await p.goto(`${WEB}/host`); await p.waitForSelector(".intro[role=dialog]");
  out("初回は紹介カードが出る（3枚）", (await p.locator(".introcard").count()) === 3);
  out("スキップがある", (await p.locator(".introskip").count()) === 1);
  await snap(p, "intro-1", false); out("[intro-1] ページ全体の横スクロールなし（カードの横並びは除く）", await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await p.click(".intro >> text=つぎへ"); await p.waitForTimeout(700); await p.click(".intro >> text=つぎへ"); await p.waitForTimeout(900);
  out("3枚目で「イベントをつくる」とサンプルへのリンク3つ", (await p.locator(".introcard:nth-child(3) .hbtn:has-text('イベントをつくる')").count()) === 1 && (await p.locator(".intro .chip.sample").count()) === 3, `samples=${await p.locator(".intro .chip.sample").count()}`);
  out("3枚目では「つぎへ」が消える", (await p.locator(".intro >> text=つぎへ").count()) === 0);
  const hrefs = await p.locator(".intro .chip.sample").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
  out("サンプルは /e/<id>/album", hrefs.every((h) => /^\/e\/[0-9a-f]{8}\/album$/.test(h)), hrefs.join());
  const stray = await p.evaluate(() => [...document.querySelectorAll(".introcard")].map((c, n) => { const r = c.getBoundingClientRect(); const bad = [...c.querySelectorAll(".introicons > *")].filter((e) => { const b = e.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1; }).length; return bad ? `${n + 1}枚目:${bad}個` : ""; }).filter(Boolean));
  out("紹介カードの絵（イラスト）がカードの中に収まって見える", stray.length === 0, stray.length ? `カードの外に出ているイラスト: ${stray.join(" ")}（.introicons 内の Phone/Envelope/Book/Star が position:absolute のまま）` : "");
  const geo = await p.evaluate(() => { const c = document.querySelector(".introcard:nth-child(3)"); const a = c.querySelector(".introicons").getBoundingClientRect(); const t = c.querySelector("h1").getBoundingClientRect(); const top = document.querySelector(".introtop").getBoundingClientRect(); return { artTop: a.top, artBottom: a.bottom, h1Top: t.top, skipBottom: top.bottom, cardScroll: c.scrollHeight, cardClient: c.clientHeight, vh: innerHeight }; });
  out("紹介3枚目: 上の絵が画面内に見える（切れていない）", geo.artTop >= geo.skipBottom - 1 && geo.artBottom <= geo.h1Top, JSON.stringify(geo));
  await snap(p, "intro-3", false); out("[intro-3] ページ全体の横スクロールなし", await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await p.click(".introcard:nth-child(3) .hbtn:has-text('イベントをつくる')");
  await p.waitForURL(`${WEB}/host/new`);
  out("「イベントをつくる」で /host/new へ。紹介は閉じる", (await p.locator(".intro").count()) === 0);
  await p.goto(`${WEB}/host`); await p.waitForTimeout(600);
  out("2回目以降は出ない", (await p.locator(".intro").count()) === 0);
  await p.close();
  const q = await mk({ keepIntro: true, keepInstall: true });
  await q.goto(`${WEB}/host`); await q.waitForSelector(".intro"); await q.click(".introskip");
  out("スキップで閉じる", (await q.locator(".intro").count()) === 0 && (await q.locator(".empty").count()) === 1);
  out("空の画面にサンプルへのリンク", (await q.locator(".empty .chip.sample").count()) === 3);
  await snap(q, "host-empty");
  await q.reload(); await q.waitForTimeout(500);
  out("スキップ後のリロードでも出ない", (await q.locator(".intro").count()) === 0);
  await q.close();
});

let evC; // 種類・ひとことつきで作ったイベント（H3 で使う）
await sec("H2 イベント作成（種類・ひとこと・空の名前）", async () => {
  const p = await mk();
  await p.goto(`${WEB}/host/new`); await p.waitForSelector(".kindgrid");
  out("種類のタイルが7つ", (await p.locator(".kindtile").count()) === 7, (await p.locator(".kindtile").allInnerTexts()).join(","));
  out("初期の選択は「そのほか」", (await p.locator(".kindtile.on").innerText()).trim() === "そのほか" && (await p.locator('input:not([type])').getAttribute("placeholder")) === "みんなのイベント");
  await snap(p, "host-new");
  await p.click(".kindtile:has-text('同窓会')");
  out("種類を選ぶと名前の例が変わる", (await p.locator('input:not([type])').getAttribute("placeholder")) === "同窓会" && (await p.locator(".hint").first().innerText()).includes("同窓会"));
  await p.click(".kindtile:has-text('結婚式')");
  out("結婚式の例は「ウェディングパーティー」", (await p.locator('input:not([type])').getAttribute("placeholder")) === "ウェディングパーティー");
  await p.click(".kindtile:has-text('同窓会')");
  await p.fill("textarea", "あ".repeat(200));
  out("ひとことは140字まで", (await p.locator("textarea").inputValue()).length === 140 && (await p.locator(".counter").innerText()).includes("140 / 140"));
  await p.fill("textarea", "ひさしぶり！一枚ずつ、たくさん撮ってね");
  await p.fill('input[type=number]', "6");
  await p.click("form button[type=submit], form button.hbtn.ghost");
  await p.waitForURL((u) => /\/host\/[0-9a-f]{8}$/.test(u.pathname)); await p.waitForSelector("img.qr"); await loaded(p);
  const id = p.url().split("/").pop();
  out("名前が空 → 種類の例「同窓会」で作られる", (await h1(p)) === "同窓会", await h1(p));
  const info = await (await fetch(`${API}/events/${id}`)).json();
  out("API に kind=reunion・message・shotLimit=6", info.kind === "reunion" && info.message === "ひさしぶり！一枚ずつ、たくさん撮ってね" && info.shotLimit === 6, JSON.stringify(info));
  evC = { id, hostToken: await p.evaluate((i) => localStorage.getItem(`ec.hostToken.${i}`), id) };
  // ひとこと未入力 → message は null
  await p.goto(`${WEB}/host/new`); await p.waitForSelector(".kindgrid"); await p.click(".kindtile:has-text('旅行')"); await p.click("form button[type=submit], form button.hbtn.ghost");
  await p.waitForURL((u) => /\/host\/[0-9a-f]{8}$/.test(u.pathname) && !u.pathname.endsWith(id)); await p.waitForSelector("img.qr"); await loaded(p);
  const id2 = p.url().split("/").pop(); const i2 = await (await fetch(`${API}/events/${id2}`)).json();
  out("旅行・ひとこと空 → 名前「旅行」、message は null", (await h1(p)) === "旅行" && i2.kind === "trip" && (i2.message === null || i2.message === undefined), JSON.stringify(i2));
  out("作成画面〜管理画面でコンソールエラーなし", errors.length === 0, errors.slice(0, 2).join("|"));
  await p.close();
});

let evS; // 段階・売れた数を見るイベント
await sec("H3 管理画面の3段階（主ボタンは常に1つ）", async () => {
  evS = await mkEv({ name: "段階テスト", shotLimit: 5, kind: "party", message: "かんぱい！" });
  const p = await mk(); await p.goto(`${WEB}/host`); await addToken(p, evS);
  await p.goto(`${WEB}/host/${evS.id}`); await p.waitForSelector("img.qr"); await loaded(p);
  out("準備中: 段階のチップとQR", (await p.locator(".stage .chip").innerText()) === "準備中" && (await p.locator(".stage img.qr").count()) === 1);
  out("準備中: 一番上のカードが段階カード", await p.evaluate(() => document.querySelector(".host-in > section")?.classList.contains("stage")));
  out("準備中: 主ボタンはちょうど1つ（QRカードを印刷）", (await primaries(p)) === 1 && (await p.locator(".stage .hbtn.ghost").innerText()) === "QRカードを印刷", `ghost=${await primaries(p)}`);
  out("準備中: 「現像する」は出ない", (await p.locator("button:has-text('現像する')").count()) === 0);
  await snap(p, "host-stage-ready");
  await shot(evS.id, "p0-guest-a-0001", 0); await shot(evS.id, "p0-guest-a-0001", 1); await shot(evS.id, "p0-guest-b-0002", 2);
  await p.reload(); await p.waitForSelector("img.qr, .stage .stats"); await loaded(p);
  await p.waitForFunction(() => document.querySelector(".stage .chip")?.textContent === "撮影中");
  const nums = await p.locator(".stage .stats b").allInnerTexts();
  out("撮影中: 撮影枚数3・ゲスト2", nums.join() === "3,2", nums.join());
  out("撮影中: 主ボタンはちょうど1つ（現像する）", (await primaries(p)) === 1 && (await p.locator(".stage .hbtn.ghost").innerText()) === "現像する", `ghost=${await primaries(p)}`);
  out("撮影中: QR は下のカードに残る", (await p.locator(".host-in img.qr").count()) === 1);
  await snap(p, "host-stage-shooting");
  // 現像
  await p.click(".stage button:has-text('現像する')"); await p.waitForSelector("[role=dialog]");
  await snap(p, "host-publish-dialog");
  await p.click("[role=dialog] button:has-text('現像する')");
  await p.waitForFunction(() => document.querySelector(".stage .chip")?.textContent === "現像済み", null, { timeout: 8000 });
  out("現像後: 段階が「現像済み」になる", true);
  out("現像済み: 主ボタンはちょうど1つ（ゲストに知らせる）", (await primaries(p)) === 1 && (await p.locator(".stage .hbtn.ghost").innerText()) === "ゲストに知らせる", `ghost=${await primaries(p)}`);
  out("現像済み: 「アルバムを見る」", (await p.locator(".stage a.shoot").innerText()) === "アルバムを見る");
  const sales0 = await p.locator(".sales .stats b").allInnerTexts();
  out("売れた数: 購入前は 0 / 0 / ¥0", sales0.join() === "0,0,¥0", sales0.join());
  await snap(p, "host-stage-developed");
  await p.close();
  // 鍵なしの GET では sales は出ない
  const pub = await (await fetch(`${API}/events/${evS.id}`)).json();
  out("API: 鍵なしでは sales が出ない・coverPhotoId は現像後に出る", pub.sales === undefined && typeof pub.coverPhotoId === "string", JSON.stringify({ sales: pub.sales, cover: pub.coverPhotoId }));
  const keyed = await (await fetch(`${API}/events/${evS.id}`, auth(evS))).json();
  out("API: 鍵ありなら sales が出る", keyed.sales && keyed.sales.digital === 0 && keyed.sales.print === 0 && keyed.sales.revenue === 0, JSON.stringify(keyed.sales));
});

await sec("H4 ゲストに知らせる（共有 / コピーのフォールバック）", async () => {
  // Web Share なし → クリップボード
  const p = await mk({ share: false, clip: true }); await p.goto(`${WEB}/host`); await addToken(p, evS);
  await p.goto(`${WEB}/host/${evS.id}`); await p.waitForSelector(".stage .hbtn.ghost:has-text('ゲストに知らせる')"); await loaded(p);
  out("share が無い環境の前提", (await p.evaluate(() => typeof navigator.share)) === "undefined");
  await p.click(".stage button:has-text('ゲストに知らせる')");
  await p.waitForSelector(".stage button:has-text('文面をコピーしました')", { timeout: 4000 });
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  out("コピーの文面に名前とゲスト用URL", clip.includes("「段階テスト」") && clip.includes(`/e/${evS.id}`) && !clip.includes(evS.hostToken) && !clip.includes("#t="), clip.replace(/\n/g, " / "));
  await snap(p, "host-notify-copied");
  await p.close();
  // Web Share あり
  const q = await mk({ share: "stub" }); await q.goto(`${WEB}/host`); await addToken(q, evS);
  await q.goto(`${WEB}/host/${evS.id}`); await q.waitForSelector(".stage .hbtn.ghost:has-text('ゲストに知らせる')"); await loaded(q);
  await q.click(".stage button:has-text('ゲストに知らせる')"); await q.waitForTimeout(400);
  const sh = await q.evaluate(() => window.__shared);
  out("共有シートに 名前・文面・URL を渡す", sh && sh.title === "段階テスト" && sh.text.includes("段階テスト") && sh.url.endsWith(`/e/${evS.id}`), JSON.stringify(sh));
  await q.close();
});

await sec("H5 QRカードの印刷ページ", async () => {
  const p = await mk(); await p.goto(`${WEB}/host`); await addToken(p, evC);
  await p.goto(`${WEB}/host/${evC.id}`); await p.waitForSelector("img.qr"); await loaded(p);
  await p.click("a:has-text('QRカードを印刷')");
  await p.waitForURL(`${WEB}/host/${evC.id}/print`); await p.waitForSelector(".pcard img");
  out("カードが4枚", (await p.locator(".pcard").count()) === 4);
  const c0 = await p.locator(".pcard").first().innerText();
  out("カードに 名前・ひとこと・使い方3行", c0.includes("同窓会") && c0.includes("ひさしぶり！") && (await p.locator(".pcard").first().locator("li").count()) === 3 && c0.includes("6枚まで"), c0.replace(/\n/g, " / "));
  out("QR は4枚とも同じゲスト用QR（画像あり）", (await p.locator(".pcard img").evaluateAll((a) => a.length === 4 && a.every((i) => i.naturalWidth > 0))));
  await snap(p, "host-print");
  await p.emulateMedia({ media: "print" });
  out("印刷時は「もどる/印刷する」が隠れてカードだけ", (await p.locator(".hprint-bar").isVisible()) === false && (await p.locator(".pcard").first().isVisible()));
  await p.emulateMedia({ media: "screen" });
  await p.click("a:has-text('もどる')"); await p.waitForURL(`${WEB}/host/${evC.id}`);
  out("もどるで管理画面へ", true);
  // 鍵のない端末でも落ちない・鍵が出ない
  const html = await p.locator("body").innerText();
  await p.goto(`${WEB}/host/${evC.id}/print`); await p.waitForSelector(".pcard img");
  out("印刷ページに hostToken が出ない", !(await p.content()).includes(evC.hostToken));
  await p.close();
});

let evBuy; // ゲスト購入用（H6/G で使う）
await sec("G0 準備: アルバム用イベント（種類別）を作る", async () => {
  // 結婚式・誕生日・そのほか(party)。me の写真が最初(表紙)になるように、me を最初に撮る
  const me = "p0-guest-me-00001";
  const mkPub = async (kind, name, n = 11) => { const e = await mkEv({ name, shotLimit: 27, kind, message: `${name}へようこそ` }); for (let i = 0; i < 4; i++) await shot(e.id, me, i); for (let i = 4; i < n; i++) await shot(e.id, `p0-guest-o${i % 3}-0000${i}`, i); await publish(e); return e; };
  globalThis.P = { wedding: await mkPub("wedding", "ふたりのテスト婚"), party: await mkPub("party", "飲み会テスト"), birthday: await mkPub("birthday", "誕生日テスト") };
  evBuy = P.party;
  out("準備: 3イベントを現像まで作った", Object.values(P).every((e) => e.id));
});

await sec("H6 マイイベント（表紙・撮影中が上・売れた数）", async () => {
  // 撮影中(古い) と 現像済み(新しい) と 写真0枚
  const shooting = await mkEv({ name: "撮影中の古いイベント", shotLimit: 5, kind: "trip" }); await shot(shooting.id, "p0-guest-s-00001", 3);
  const empty = await mkEv({ name: "まだ0枚", shotLimit: 5, kind: "birthday" });
  const p = await mk(); await p.goto(`${WEB}/host`);
  const now = Date.now();
  const mine = [[shooting, now - 5 * 86400e3], [P.party, now - 3 * 86400e3], [empty, now - 1 * 86400e3]];
  await p.evaluate(([list]) => { for (const [e, t] of list) { localStorage.setItem(`ec.hostToken.${e.id}`, e.hostToken); } localStorage.setItem("ec.myEvents", JSON.stringify(list.map(([e, t]) => ({ id: e.id, name: e.name, createdAt: new Date(t).toISOString() })))); }, [mine]);
  const keys = await p.evaluate(() => Object.keys(localStorage));
  await p.goto(`${WEB}/host`); await p.waitForFunction(() => document.querySelectorAll(".evcard .chip").length === 3);
  const names = await p.locator(".evname2").allInnerTexts();
  out("撮影中のイベント2件（0枚のものと古いもの）が上、現像済みが下", names.slice(0, 2).sort().join() === ["まだ0枚", "撮影中の古いイベント"].sort().join() && names[2] === "飲み会テスト", names.join(" > "));
  await p.waitForTimeout(1200);
  const covers = await p.locator(".evcard").evaluateAll((cs) => cs.map((c) => ({ img: !!c.querySelector(".evcover img"), ok: c.querySelector(".evcover img")?.naturalWidth > 0 })));
  const iE = names.indexOf("まだ0枚"), iS = names.indexOf("撮影中の古いイベント"), iP = names.indexOf("飲み会テスト");
  out("写真のあるイベントは表紙の写真（撮影中は鍵つき、現像後は鍵なし）が出る", covers[iS].img && covers[iS].ok && covers[iP].img && covers[iP].ok, JSON.stringify(covers));
  out("写真0枚は種類のアイコン", !covers[iE].img && (await p.locator(".evcard").nth(iE).locator(".evcover svg").count()) === 1);
  const t1 = await p.locator(".evcard").nth(iP).innerText();
  out("現像済みのカードに「売れた n 冊」", t1.includes("売れた 0 冊") && t1.includes("現像済み"), t1.replace(/\n/g, " / "));
  await snap(p, "host-list");
  out("マイイベントにサンプルへのリンク", (await p.locator(".samples .chip.sample").count()) === 3);
  await p.close();
});

await sec("H7 ホーム画面に追加の案内は、イベントを作ったあとだけ", async () => {
  const p = await mk({ keepInstall: true, ua: IOS_UA });
  await p.goto(`${WEB}/host`); await p.waitForSelector(".empty"); await p.waitForTimeout(500);
  out("イベントが無いうちは出ない", (await p.locator(".install").count()) === 0);
  await p.goto(`${WEB}/host/new`); await p.waitForSelector(".kindgrid"); await p.click("form button[type=submit], form button.hbtn.ghost");
  await p.waitForURL((u) => /\/host\/[0-9a-f]{8}$/.test(u.pathname)); await p.waitForSelector("img.qr");
  out("作成直後の管理画面には出ない", (await p.locator(".install").count()) === 0);
  await p.goto(`${WEB}/host`); await p.waitForSelector(".evcard"); await p.waitForSelector(".install", { timeout: 4000 }).catch(() => {});
  out("イベントを作ったあとの一覧で案内が出る（iOS: 手順つき）", (await p.locator(".install").count()) === 1 && (await p.locator(".install").innerText()).includes("ホーム画面に追加"));
  await snap(p, "host-install");
  await p.reload(); await p.waitForSelector(".evcard"); await p.waitForTimeout(500);
  out("2回目以降は出ない（1回だけ）", (await p.locator(".install").count()) === 0);
  await p.close();
});

// ================= ゲスト =================
await sec("G1 ようこそ画面 → 3タップ以内に撮影", async () => {
  const e = await mkEv({ name: "ようこそテスト", shotLimit: 4, kind: "birthday", message: "みんなで祝おう！" });
  const p = await mk({ cam: true });
  await p.goto(`${WEB}/e/${e.id}`); await p.waitForSelector(".welcome-ov");
  const t = await p.locator(".welcome-ov").innerText();
  out("ようこそ: 名前・ひとこと・ルール3つ", t.includes("ようこそテスト") && t.includes("みんなで祝おう！") && (await p.locator(".welcome-ov .rules li").count()) === 3 && t.includes("1人4枚まで") && t.includes("その場では見られません") && t.includes("絵日記がとどきます"), t.replace(/\n/g, " / ").slice(0, 160));
  out("ようこそ: 誕生日の文言（お祝い）", t.includes("お祝いの1日"));
  await snap(p, "guest-welcome");
  let taps = 0;
  await p.click(".welcome-ov >> text=カメラをはじめる"); taps++;
  await p.waitForSelector(".welcome-ov", { state: "detached", timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("撮影できます"));
  out("カメラ起動後、ようこそは消える", (await p.locator(".welcome-ov").count()) === 0);
  await p.click("button.shutter"); taps++;
  await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("巻き上げ待ち"));
  out(`3タップ以内に1枚目 (タップ数=${taps})`, taps <= 3);
  await snap(p, "guest-camera");
  await p.waitForTimeout(1500);
  // G2: 撮ったことのある端末はようこそを飛ばす
  await p.goto(`${WEB}/e/${e.id}`); await p.waitForSelector(".cam"); await p.waitForTimeout(600);
  out("撮ったことのある端末ではようこそを出さない", (await p.locator(".welcome-ov").count()) === 0 && (await p.locator(".cam .start").count()) === 1);
  await snap(p, "guest-camera-return");
  out("ようこその次の来訪: 残り枚数は3", (await p.locator(".cam .start").innerText()).includes("残り 3 枚"), (await p.locator(".cam .start").innerText()).replace(/\n/g, " "));
  // 別の端末(別の guestId)ではまた出る
  const q = await mk({ cam: true }); await q.goto(`${WEB}/e/${e.id}`); await q.waitForSelector(".cam"); await q.waitForTimeout(400);
  out("別の端末では出る", (await q.locator(".welcome-ov").count()) === 1);
  await q.close(); await p.close();
  // ひとことが無いイベントでも崩れない
  const e2 = await mkEv({ name: "ひとこと無し", shotLimit: 27 });
  const r = await mk({ cam: true }); await r.goto(`${WEB}/e/${e2.id}`); await r.waitForSelector(".welcome-ov");
  out("ひとこと無しでも表示できる（.hostmsg なし）", (await r.locator(".welcome-ov .hostmsg").count()) === 0 && (await r.locator(".welcome-ov .rules li").count()) === 3);
  await r.close();
  // 長いひとこと(140字)
  const e3 = await mkEv({ name: "とても長いイベントの名前をつけたウェディングパーティー二次会の写真", shotLimit: 27, kind: "other", message: "あ".repeat(140) });
  const s = await mk({ cam: true }); await s.goto(`${WEB}/e/${e3.id}`); await s.waitForSelector(".welcome-ov");
  await snap(s, "guest-welcome-long");
  await s.close();
});

await sec("G3 カメラ権限が拒否されたときの案内", async () => {
  const e = await mkEv({ name: "権限テスト", shotLimit: 5 });
  // Playwright の権限で拒否（フェイクUIフラグなしのブラウザ）
  const b2 = await chromium.launch({ args: ["--use-fake-device-for-media-stream"] });
  const c = await b2.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true, userAgent: IOS_UA, permissions: [] });
  await c.addInitScript(() => { try { localStorage.setItem("ec.introSeen", "1"); } catch {} });
  const p = await c.newPage();
  await p.goto(`${WEB}/e/${e.id}`); await p.waitForSelector(".welcome-ov");
  await p.click(".welcome-ov >> text=カメラをはじめる");
  const got = await p.waitForSelector(".deny, .start [role=alert]", { timeout: 8000 }).then(() => true).catch(() => false);
  const denied = await p.locator(".deny").count();
  console.log(`   (参考) 権限なしの実ブラウザ: .deny=${denied} ${denied ? "" : "→ NotAllowedError にならず別のエラー文: " + (await p.locator(".start").innerText().catch(() => ""))}`);
  await b2.close();
  // 確実に NotAllowedError を返して確認（iPhone / Android / PC の3種）
  for (const [name, ua, want] of [["iPhone", IOS_UA, ["iPhone"]], ["Android", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36", ["Android（Chrome）"]], ["PC", undefined, ["iPhone", "Android（Chrome）"]]]) {
    const q = await mk({ denyCamera: true, ua });
    await q.goto(`${WEB}/e/${e.id}`); await q.waitForSelector(".welcome-ov");
    await q.click(".welcome-ov >> text=カメラをはじめる");
    await q.waitForSelector(".deny");
    const t = await q.locator(".deny").innerText();
    out(`権限拒否(${name}): 案内が出る`, t.includes("カメラが使えません") && want.every((w) => t.includes(w)) && (name === "PC" || !t.includes(name === "iPhone" ? "Android" : "iPhone")), t.replace(/\n/g, " / ").slice(0, 140));
    out(`権限拒否(${name}): 「もう一度ためす」ボタン`, (await q.locator(".start button:has-text('もう一度ためす')").count()) === 1);
    if (name === "iPhone") await snap(q, "guest-denied");
    await q.close();
  }
});

await sec("G4 アルバム: ページ番号・スワイプ・「あなたが撮った」シール", async () => {
  const E = P.party;
  const album = await (await fetch(`${API}/events/${E.id}/album?guestId=p0-guest-me-00001`)).json();
  const apiMine = album.pages.flatMap((p) => p.photos).filter((x) => x.mine).length;
  const allPhotos = album.pages.flatMap((p) => p.photos).length;
  out("API: mine の数が 4（自分が撮った枚数）", apiMine === 4 && allPhotos === 11, `mine=${apiMine} all=${allPhotos}`);
  out("API: album の写真に guestId を返さない", album.pages.flatMap((p) => p.photos).every((x) => x.guestId === undefined && typeof x.mine === "boolean"));
  const anon = await (await fetch(`${API}/events/${E.id}/album`)).json();
  out("API: guestId なしでは全て mine=false", anon.pages.flatMap((p) => p.photos).every((x) => x.mine === false));
  out("API: album の event に kind・message", album.event.kind === "party" && album.event.message === "飲み会テストへようこそ", JSON.stringify(album.event));
  const p = await mk({ guestId: "p0-guest-me-00001" });
  await p.goto(`${WEB}/e/${E.id}`); await p.waitForSelector("text=ひらく"); await p.click("text=ひらく"); await p.waitForSelector(".dpage.cover");
  const total = Number((await p.locator(".pn").innerText()).split("/")[1]);
  out("ページ番号「1 / N」", (await p.locator(".pn").innerText()).trim().startsWith("1 / ") && total === album.pages.filter((x) => x.photos.length).length + 1, await p.locator(".pn").innerText());
  out("最初のページでは「まえ」が無効", await p.locator(".pager button:has-text('まえ')").isDisabled());
  await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 6000 }).catch(() => {});
  await snap(p, "guest-album-cover");
  // スワイプ
  await swipe(p, -120); await p.waitForTimeout(250);
  out("左スワイプで次のページ（2 / N）", (await p.locator(".pn").innerText()).trim().startsWith("2 / "), await p.locator(".pn").innerText());
  await swipe(p, 120); await p.waitForTimeout(250);
  out("右スワイプで前のページ（1 / N）", (await p.locator(".pn").innerText()).trim().startsWith("1 / "));
  await swipe(p, -20); await p.waitForTimeout(150);
  out("小さなスワイプではめくらない", (await p.locator(".pn").innerText()).trim().startsWith("1 / "));
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(200);
  out("矢印キーでもめくれる", (await p.locator(".pn").innerText()).trim().startsWith("2 / "));
  await p.keyboard.press("ArrowLeft");
  // 各ページのシール
  let stickers = 0, frames = 0, perPage = [];
  let stk = "";
  for (let i = 0; i < total - 1; i++) {
    await p.waitForTimeout(80);
    if (!stk) stk = await p.locator(".dpage .sticker").first().innerText().catch(() => "");
    const s = await p.locator(".dpage .sticker").count(), f = await p.locator(".dpage .pframe").count();
    stickers += s; frames += f; perPage.push(`${i + 1}:${s}/${f}`);
    if (i === 1) await snap(p, "guest-album-page");
    await p.click(".pager button:has-text('つぎ')");
  }
  out("シールの総数 = 自分が撮った枚数（表紙を含む）", stickers === apiMine, `見えたシール=${stickers} / mine=${apiMine} / 写真=${frames} [${perPage.join(" ")}]`);
  console.log(`   (参考) シールの文言: 「${stk}」`);
  out("シールが付くのは自分の写真だけ（シール数 < 写真数）", stickers < frames, `${stickers}/${frames}`);
  
  // 最後のページ
  out("最後のページに「おわりのページ」", (await p.locator(".dpage.end").count()) === 1 && (await p.locator(".pn").innerText()).trim() === `${total} / ${total}`);
  out("最後のページ: 「あなたが撮った写真が 4 枚入っています」", (await p.locator(".dpage.end").innerText()).includes("あなたが撮った写真が 4 枚入っています"), (await p.locator(".dpage.end").innerText()).replace(/\n/g, " / "));
  out("最後のページでは「つぎ」が無効", await p.locator(".pager button:has-text('つぎ')").isDisabled());
  await snap(p, "guest-album-end");
  await p.close();
  // 別の端末(自分の写真なし)にはシールも枚数の行も出ない
  const q = await mk({ guestId: "p0-someone-else-0001" });
  await q.goto(`${WEB}/e/${E.id}/album`); await q.waitForSelector(".dpage.cover");
  let st = 0;
  for (let i = 0; i < total - 1; i++) { st += await q.locator(".dpage .sticker").count(); await q.click(".pager button:has-text('つぎ')"); }
  out("自分の写真が無い端末にはシールが出ない", st === 0, `${st}`);
  out("自分の写真が無い端末の最後のページに枚数の行が無い", !(await q.locator(".dpage.end").innerText()).includes("あなたが撮った"));
  await q.close();
});

await sec("G5 購入: 選ぶシート → デジタル → 購入済み → 印刷（住所・受付）", async () => {
  const E = P.birthday; // デジタル用
  const p = await mk({ guestId: "p0-guest-me-00001", share: false, clip: true });
  await p.goto(`${WEB}/e/${E.id}/album`); await p.waitForSelector(".dpage.cover");
  await goEnd(p);
  out("購入前の最後のページに「えらぶ」", (await p.locator(".dpage.end .hbtn2:has-text('えらぶ')").count()) === 1 && (await p.locator(".paidtag").count()) === 0);
  await p.click(".dpage.end >> text=えらぶ"); await p.waitForSelector(".buy");
  const cards = await p.locator(".buy .hcard").allInnerTexts();
  out("購入シート: デジタル ¥500 / 印刷 ¥3,000", cards.length === 2 && cards[0].includes("デジタル版") && cards[0].includes("¥500") && cards[1].includes("印刷版フォトブック") && cards[1].includes("¥3,000"), cards.map((c) => c.replace(/\n/g, " ")).join(" | ").slice(0, 200));
  out("購入シート: デジタルに高画質・1枚ずつ保存・共有リンク・1年", ["高画質", "1枚ずつ保存", "共有リンク", "1年間"].every((w) => cards[0].includes(w)));
  out("購入シート: 印刷にページ数・A5・送料込み・お届け目安", /\d+ページ/.test(cards[1]) && cards[1].includes("A5") && cards[1].includes("送料込み") && cards[1].includes("7〜10日"), cards[1].replace(/\n/g, " "));
  const pages = Number(cards[1].match(/(\d+)ページ/)?.[1]);
  out("印刷のページ数は偶数", pages % 2 === 0 && pages >= 4, `${pages}`);
  out("購入シート: モックの注記", (await p.locator(".buy").innerText()).includes("モックです"));
  await snap(p, "guest-buy");
  out("購入シートの戻るでアルバムに戻る", await (async () => { await p.click(".buy >> text=アルバムにもどる"); await p.waitForSelector(".dpage.end"); return true; })());
  await p.click(".dpage.end >> text=えらぶ"); await p.waitForSelector(".buy");
  await p.locator(".buy .hcard button").first().click(); await p.waitForSelector(".donep");
  const d = await p.locator(".donep").innerText();
  out("デジタル完了: 商品名・金額・注文番号", d.includes("デジタル版") && d.includes("¥500") && d.includes("注文番号"), d.replace(/\n/g, " / ").slice(0, 120));
  const nPhotos = await p.locator(".plist img").count();
  out("デジタル完了: 全写真の一覧（11枚）と保存の案内", nPhotos === 11 && d.includes("長押しで保存"), `${nPhotos}`);
  await p.waitForTimeout(800);
  out("デジタル完了: 一覧の画像が読み込まれる", await p.locator(".plist img").evaluateAll((a) => a.every((i) => i.naturalWidth > 0)));
  await snap(p, "guest-done-digital");
  await p.click(".donep >> text=友だちに知らせる"); await p.waitForSelector(".donep [role=status]");
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  out("共有: Web Share が無ければリンクをコピー", clip.includes(`/e/${E.id}/album`) && clip.includes("誕生日テスト"), clip.replace(/\n/g, " / "));
  out("完了画面に配達先フォームは出ない(デジタル)", (await p.locator(".dform").count()) === 0);
  await p.click(".donep >> text=アルバムにもどる"); await p.waitForSelector(".dpage.end");
  out("購入後: 最後のページが「購入済み」", (await p.locator(".dpage.end .paidtag").innerText()) === "購入済み" && (await p.locator(".dpage.end >> text=えらぶ").count()) === 0);
  out("購入後(デジタル): 「写真を保存」ボタン", (await p.locator(".dpage.end button:has-text('写真を保存')").count()) === 1);
  await p.click(".dpage.end button:has-text('写真を保存')"); await p.waitForSelector(".donep");
  out("「写真を保存」で写真一覧へ", (await p.locator(".plist img").count()) === 11);
  await p.reload(); await p.waitForSelector(".dpage.cover"); await goEnd(p);
  out("リロードしても購入済み", (await p.locator(".dpage.end .paidtag").count()) === 1);
  await p.close();
  // 別の端末では購入済みにならない
  const o = await mk({ guestId: "p0-other-device-0001" }); await o.goto(`${WEB}/e/${E.id}/album`); await o.waitForSelector(".dpage.cover"); await goEnd(o);
  out("別の端末は購入済みにならない", (await o.locator(".dpage.end .paidtag").count()) === 0 && (await o.locator(".dpage.end >> text=えらぶ").count()) === 1);
  await o.close();
  // 印刷
  const q = await mk({ guestId: "p0-guest-print-0001" });
  await q.goto(`${WEB}/e/${E.id}/album`); await q.waitForSelector(".dpage.cover"); await goEnd(q);
  await q.click(".dpage.end >> text=えらぶ"); await q.waitForSelector(".buy");
  await q.locator(".buy .hcard button").nth(1).click(); await q.waitForSelector(".donep");
  const dp = await q.locator(".donep").innerText();
  out("印刷完了: 商品名と ¥3,000、お届け先の案内", dp.includes("印刷版フォトブック") && dp.includes("¥3,000") && dp.includes("お届け先"), dp.replace(/\n/g, " / ").slice(0, 120));
  out("印刷完了: 住所フォーム（お名前・郵便番号・ご住所）", (await q.locator(".dform input").count()) === 3);
  out("印刷完了: 未入力では送信できない", await q.locator(".dform button[type=submit]").isDisabled());
  await q.fill(".dform label:has-text('お名前') input", "山田 花子"); await q.fill(".dform label:has-text('郵便番号') input", "100-0001");
  out("印刷完了: 一部だけでは送信できない", await q.locator(".dform button[type=submit]").isDisabled());
  await q.fill(".dform label:has-text('ご住所') input", "東京都千代田区1-1");
  await snap(q, "guest-done-print");
  await q.click(".dform button[type=submit]"); await q.waitForSelector(".donep [role=status]");
  out("印刷: 「受け付けました（デモでは送られません）」", (await q.locator(".donep [role=status]").innerText()).includes("受け付けました"), await q.locator(".donep [role=status]").innerText());
  out("印刷: 受付後はフォームが消える", (await q.locator(".dform").count()) === 0);
  await q.click(".donep >> text=アルバムにもどる"); await q.waitForSelector(".dpage.end");
  out("印刷購入後: 「購入済み」・「写真を保存」は出ない", (await q.locator(".dpage.end .paidtag").count()) === 1 && (await q.locator(".dpage.end button:has-text('写真を保存')").count()) === 0);
  await q.close();
  // 売れた数（ホスト側）
  const keyed = await (await fetch(`${API}/events/${E.id}`, auth(E))).json();
  out("API: sales = デジタル1・印刷1・¥3,500", keyed.sales.digital === 1 && keyed.sales.print === 1 && keyed.sales.revenue === 3500, JSON.stringify(keyed.sales));
  const h = await mk(); await h.goto(`${WEB}/host`); await addToken(h, E);
  await h.goto(`${WEB}/host/${E.id}`); await h.waitForSelector(".sales"); await loaded(h);
  const s = await h.locator(".sales .stats").innerText();
  out("管理画面の売れた数: デジタル1・印刷1・合計¥3,500", s.replace(/\s+/g, " ").includes("1 デジタル") && s.replace(/\s+/g, " ").includes("1 印刷") && s.includes("¥3,500"), s.replace(/\n/g, " "));
  out("管理画面: 「合計 2 冊」の注記", (await h.locator(".sales .notice").innerText()).includes("合計 2 冊"));
  await snap(h, "host-sales");
  await h.goto(`${WEB}/host`); await h.evaluate((e) => { localStorage.setItem("ec.myEvents", JSON.stringify([{ id: e.id, name: "誕生日テスト", createdAt: new Date().toISOString() }])); }, E);
  await h.goto(`${WEB}/host`); await h.waitForSelector(".evcard .chip");
  out("マイイベントのカードに「売れた 2 冊」", (await h.locator(".evcard").innerText()).includes("売れた 2 冊"), (await h.locator(".evcard").innerText()).replace(/\n/g, " / "));
  await h.close();
});

await sec("G6 種類別の文言（結婚式だけ「ふたりの絵日記」）", async () => {
  const texts = {};
  for (const k of ["wedding", "party", "birthday"]) {
    const E = P[k]; const p = await mk({ guestId: "p0-guest-me-00001" });
    await p.goto(`${WEB}/e/${E.id}`); await p.waitForSelector("text=ひらく");
    const ann = await p.locator("body").innerText();
    await p.click("text=ひらく"); await p.waitForSelector(".dpage.cover");
    const cover = await p.locator(".dpage.cover").innerText();
    const memos = [];
    for (let i = 0; i < 6 && !(await p.locator(".pager button:has-text('つぎ')").isDisabled()); i++) { await p.click(".pager button:has-text('つぎ')"); memos.push(await p.locator(".dpage .dlines").innerText({ timeout: 500 }).catch(() => "")); }
    await goEnd(p);
    const end = await p.locator(".dpage.end").innerText();
    await p.click(".dpage.end >> text=えらぶ"); await p.waitForSelector(".buy");
    const buy = await p.locator(".buy").innerText();
    texts[k] = { ann, cover, memos: memos.join(" "), end, buy };
    if (k === "wedding") await snap(p, "guest-album-end-wedding", false);
    await p.close();
  }
  const w = texts.wedding, pa = texts.party, b = texts.birthday;
  out("結婚式: 表紙が「ふたりの絵日記 ・ vol.1」", w.cover.includes("ふたりの絵日記"), w.cover.split("\n")[0]);
  out("結婚式: 最後のページ「ふたりの絵日記を手元にのこす?」", w.end.includes("ふたりの絵日記を手元にのこす"));
  out("そのほか(飲み会): 表紙が「みんなの絵日記」", pa.cover.includes("みんなの絵日記") && !pa.cover.includes("ふたりの"), pa.cover.split("\n")[0]);
  out("飲み会: 最後のページ「今夜の絵日記を手元にのこす?」", pa.end.includes("今夜の絵日記を手元にのこす"));
  out("誕生日: 表紙は「みんなの絵日記」、最後は「このお祝いの絵日記」", b.cover.includes("みんなの絵日記") && b.end.includes("このお祝いの絵日記を手元にのこす"));
  out("結婚式以外のアルバム・購入に「ふたり/新郎/新婦/披露宴」が出ない", ![pa, b].some((t) => Object.values(t).some((s) => WEDDINGISH.test(s))), JSON.stringify([pa, b].map((t) => Object.entries(t).filter(([, s]) => WEDDINGISH.test(s)).map(([k]) => k))));
  out("ページのひとことが種類で変わる（飲み会 vs 結婚式）", pa.memos !== w.memos && /かんぱい|たのしかった/.test(pa.memos) && /しあわせ/.test(w.memos));
  // ようこそ・待つ画面
  const copyOf = {};
  for (const k of ["wedding", "party"]) {
    const e = await mkEv({ name: `文言${k}`, shotLimit: 1, kind: k });
    const p = await mk({ cam: true }); await p.goto(`${WEB}/e/${e.id}`); await p.waitForSelector(".welcome-ov");
    const wel = await p.locator(".welcome-ov").innerText();
    await p.click(".welcome-ov >> text=カメラをはじめる"); await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("撮影できます")); await p.click("button.shutter");
    await p.waitForSelector(".dpage.screen >> text=撮りおわりました", { timeout: 8000 });
    const wait = await p.locator(".dpage.screen").innerText();
    copyOf[k] = { wel, wait };
    if (k === "party") await snap(p, "guest-wait");
    await p.close();
  }
  out("ようこそ・待つ: 結婚式だけ「ふたり」", WEDDINGISH.test(copyOf.wedding.wel + copyOf.wedding.wait) && !WEDDINGISH.test(copyOf.party.wel + copyOf.party.wait), JSON.stringify({ w: copyOf.wedding.wait.split("\n").slice(0, 3), p: copyOf.party.wait.split("\n").slice(0, 3) }));
  // ホスト画面・印刷
  const h = await mk(); await h.goto(`${WEB}/host`); await addToken(h, P.party);
  await h.goto(`${WEB}/host/${P.party.id}`); await h.waitForSelector(".stage"); await loaded(h);
  out("ホスト画面(飲み会)にも結婚式の言葉が出ない", !WEDDINGISH.test(await h.locator("body").innerText()));
  await h.close();
});

await sec("G7 375px・コンソールエラー", async () => {
  out("全画面を通してコンソールエラーなし", errors.length === 0, errors.slice(0, 4).join(" | "));
});

// ================= 本番（読み取りのみ） =================
await sec("P 本番の読み取り（GET のみ。何も作らない）", async () => {
  const id = "09397db3";
  const r = await fetch(`${PROD}/events/${id}`);
  const ev = await r.json();
  out("本番: GET /events/09397db3", r.status === 200 && ev.status === "published", `${r.status} ${ev.status}`);
  out("本番: kind・message・coverPhotoId が返る", "kind" in ev && "message" in ev && typeof ev.coverPhotoId === "string", JSON.stringify({ kind: ev.kind, message: ev.message, cover: ev.coverPhotoId }));
  out("本番: 鍵なしでは sales / hostToken が出ない", ev.sales === undefined && ev.hostToken === undefined && ev.host_token === undefined);
  const cover = await fetch(`https://event-camera-api.kom-commoc.workers.dev/api/photos/${ev.coverPhotoId}`);
  out("本番: coverPhotoId の画像が取れる（現像済みなので鍵なしで可）", cover.status === 200 && (cover.headers.get("content-type") ?? "").includes("image"), `${cover.status} ${cover.headers.get("content-type")}`);
  const al = await (await fetch(`${PROD}/events/${id}/album?guestId=prod-qa-readonly-guest-0001`)).json();
  const ph = al.pages.flatMap((p) => p.photos);
  out("本番: album の写真すべてに mine(boolean)、guestId は返さない", ph.length > 0 && ph.every((x) => typeof x.mine === "boolean" && x.guestId === undefined), `photos=${ph.length} mine=${ph.filter((x) => x.mine).length}`);
  out("本番: 知らない guestId では mine は全部 false", ph.every((x) => x.mine === false));
  out("本番: album の event に kind・message", "kind" in al.event && "message" in al.event, JSON.stringify(al.event));
  for (const [i, n] of [["053af547", "ガーデンBBQ"], ["200753d9", "ウェディングパーティー"]]) {
    const s = await fetch(`${PROD}/events/${i}`); const j = await s.json();
    out(`本番: サンプル ${n} が現像済みで kind を返す`, s.status === 200 && j.status === "published" && "kind" in j, `${s.status} ${j.name} ${j.status} ${j.kind}`);
  }
});

await browser.close();
console.log(ng ? `${ng} 件 NG` : "ALL OK");
process.exit(ng ? 1 : 0);
