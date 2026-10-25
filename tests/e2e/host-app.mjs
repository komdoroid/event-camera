// T12 ホストのアプリ枠（マイイベント・下部タブ・PWA）。実 API(:8787) + web(:5173、実 API 向け) が必要。
import { chromium } from "playwright";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const J = { "Content-Type": "application/json" };
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
let ng = 0;
const out = (n, ok, d = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${n}${d ? " : " + d : ""}`); };
const browser = await chromium.launch();
const mkctx = async () => { const c = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await c.addInitScript(() => { try { localStorage.setItem("ec.introSeen", "1"); localStorage.setItem("ec.installShown", "1"); } catch {} }); const p = await c.newPage(); p.errors = []; p.on("console", (m) => { if (m.type() === "error") p.errors.push(m.text()); }); p.on("pageerror", (e) => p.errors.push("pageerror " + e.message)); return p; };
const noH = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const snap = (p, n, full = false) => p.waitForTimeout(500).then(() => p.screenshot({ path: `${SHOT}host-app-${n}.png`, fullPage: full }));
const on = (p) => p.evaluate(() => [...document.querySelectorAll(".htabs a.tab.on")].map((a) => a.innerText.trim()));

const p = await mkctx();
// 1. / -> /host, 空
await p.goto(`${WEB}/`);
await p.waitForURL(`${WEB}/host`);
out("/ -> /host へ移る", true);
await p.waitForSelector(".empty");
out("空のときの表示", (await p.locator(".empty h1").innerText()).includes("まだイベントがありません"));
out("title", (await p.title()) === "絵日記カメラ", await p.title());
out("空: 下部タブでホームが選択中", (await on(p)).join() === "ホーム", (await on(p)).join());
out("空: 横スクロールなし", await noH(p));
await snap(p, "01-empty");
// 2. 作成 -> 管理 -> 戻る
await p.click("text=最初のイベントをつくる");
await p.waitForURL(`${WEB}/host/new`);
await p.waitForTimeout(500);
out("つくる画面で「つくる」タブが選択中", (await on(p)).join() === "つくる", (await on(p)).join());
await snap(p, "02-new");
await p.fill('input:not([type])', "Host App Test");
await p.fill('input[type=number]', "4");
await p.click("form button.hbtn");
await p.waitForURL((u) => /\/host\/[0-9a-f]{8}$/.test(u.pathname));
const id = p.url().split("/").pop();
await p.waitForSelector("img.qr");
out("管理画面ではホームが選択中", (await on(p)).join() === "ホーム", (await on(p)).join());
out("管理画面に戻るボタン・タイトル", (await p.locator(".hback").count()) === 1 && (await p.locator(".htitle").innerText()) === "イベント管理");
await snap(p, "03-manage", false);
// 下部タブが画面下に固定され、内容が隠れない
const geo = async () => p.evaluate(() => { const t = document.querySelector(".htabs").getBoundingClientRect(); const m = document.querySelector(".hmain"); const last = [...document.querySelectorAll(".host-in > *")].pop().getBoundingClientRect(); return { tabsBottom: t.bottom, vh: innerHeight, tabsTop: t.top, lastBottom: last.bottom, mainScrollable: document.querySelector(".host").scrollHeight > document.querySelector(".host").clientHeight, winScroll: document.documentElement.scrollHeight > innerHeight }; });
let g = await geo();
out("下部タブが画面下に固定", Math.abs(g.tabsBottom - g.vh) < 1, JSON.stringify(g));
await p.evaluate(() => { const m = document.querySelector(".host"); m.scrollTop = m.scrollHeight; });
await p.waitForTimeout(300);
g = await geo();
out("最下部までスクロールしても内容がタブに隠れない", g.lastBottom <= g.tabsTop + 1, `last=${g.lastBottom} tabsTop=${g.tabsTop}`);
out("スクロール後もタブは画面下", Math.abs(g.tabsBottom - g.vh) < 1);
await snap(p, "04-manage-bottom");
// 戻る -> 一覧
await p.click(".hback");
await p.waitForSelector(".evcard");
out("戻ると一覧にカードが出る", (await p.locator(".evcard").count()) === 1);
await p.waitForSelector(".evcard .chip");
let txt = await p.locator(".evcard").innerText();
out("カード: 名前・状態・枚数", txt.includes("Host App Test") && txt.includes("撮影中") && txt.includes("ゲスト 0 人 ・ 0 枚"), txt.replace(/\n/g, " / "));
// API で写真を入れて現像 -> カード更新
const s = await (await fetch(`${API}/events/${id}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId: "host-app-guest-1" }) })).json();
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG });
const ev2 = await (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name: "Second Event", shotLimit: 3 }) })).json();
await p.goto(`${WEB}/host/${ev2.id}#t=${ev2.hostToken}`); // 管理用リンクでマイイベントに追加
await p.waitForSelector("img.qr");
await fetch(`${API}/events/${ev2.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${ev2.hostToken}` } });
await p.goto(`${WEB}/host`);
await p.waitForFunction(() => document.querySelectorAll(".evcard .chip").length === 2);
txt = await p.locator(".evlist").innerText();
out("一覧: 2件。枚数と現像済みチップが反映", txt.includes("ゲスト 1 人 ・ 1 枚") && txt.includes("現像済み") && txt.includes("撮影中"), txt.replace(/\n/g, " / "));
out("管理用リンクで開いたイベントが一覧に追加される", txt.includes("Second Event"));
const names = await p.locator(".evname2").allInnerTexts();
out("撮影中を上に固定（Host App Test が先頭、現像済みの Second は下）", names[0] === "Host App Test" && names[1] === "Second Event", names.join(","));
await snap(p, "05-list");
out("一覧: 横スクロールなし", await noH(p));
// カード -> 管理
await p.locator(".evmain").nth(0).click();
await p.waitForURL(`${WEB}/host/${id}`);
await p.waitForSelector("img.qr");
out("カードから管理画面へ（hostToken が保存済みで入れる）", true);
await p.click(".hback"); await p.waitForSelector(".evcard");
// ⋯ -> 外す
await p.locator(".evdel").nth(0).click();
await p.waitForSelector("[role=dialog]");
await snap(p, "06-remove-dialog");
await p.click("[role=dialog] button:has-text('やめる')");
out("やめるで残る", (await p.locator(".evcard").count()) === 2);
await p.locator(".evdel").nth(0).click();
await p.click("[role=dialog] button:has-text('外す')");
await p.waitForTimeout(300);
out("外すと一覧から消える", (await p.locator(".evcard").count()) === 1 && !(await p.locator(".evlist").innerText()).includes("Host App Test"));
const still = await fetch(`${API}/events/${id}`); out("外してもサーバーのイベントは残る", still.status === 200);
// 別コンテキストで管理用リンク
const q = await mkctx();
await q.goto(`${WEB}/host/${id}#t=PLACEHOLDER`);
await q.close();
const e3 = await (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name: "Shared Link Event", shotLimit: 3 }) })).json();
const q2 = await mkctx();
await q2.goto(`${WEB}/host/${e3.id}#t=${e3.hostToken}`);
await q2.waitForSelector("img.qr");
await q2.click(".hback"); await q2.waitForSelector(".evcard");
out("管理用リンクを別コンテキストで開くとその一覧にも入る", (await q2.locator(".evlist").innerText()).includes("Shared Link Event"));
// 不正トークンのリンク
const q3 = await mkctx();
await q3.goto(`${WEB}/host/${e3.id}#t=wrong-token`);
await q3.waitForTimeout(1500);
await q3.goto(`${WEB}/host`);
const bad = await q3.locator("body").innerText();
console.log("   (参考) 不正トークンのリンクを開いたあとの一覧:", bad.includes("Shared Link Event") ? "イベントが一覧に入る" : "入らない");
// 3. ゲスト画面にタブが出ない
for (const [name, url, sel] of [["guest-camera", `/e/${e3.id}`, ".cam"], ["guest-announce", `/e/${ev2.id}`, "text=ひらく"], ["guest-album", `/e/${ev2.id}/album`, ".dpage"]]) {
  const gp = await mkctx();
  await gp.goto(WEB + url); await gp.waitForSelector(sel); await gp.waitForTimeout(800);
  out(`${name}: 下部タブ・上部バーが出ない`, (await gp.locator(".htabs, .htop, .hshell").count()) === 0);
  if (name === "guest-album") { await gp.click("text=えらぶ"); await gp.waitForSelector(".buy"); out("guest-buy: タブが出ない", (await gp.locator(".htabs").count()) === 0); await gp.locator(".hcard button").first().click(); await gp.waitForSelector("text=ありがとう"); out("guest-done: タブが出ない", (await gp.locator(".htabs").count()) === 0); }
  out(`${name}: 横スクロールなし`, await noH(gp));
  const tc = await gp.evaluate(() => document.querySelector('meta[name=theme-color]')?.content);
  console.log(`   ${name} theme-color=${tc}`);
  await gp.close();
}
// theme-color: カメラは黒、離れたら戻る
{
  const c = await browser.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true });
  const gp = await c.newPage();
  await gp.goto(`${WEB}/host`);
  const before = await gp.evaluate(() => document.querySelector('meta[name=theme-color]')?.content);
  await gp.goto(`${WEB}/e/${e3.id}`); await gp.waitForSelector(".cam");
  const wel = await gp.evaluate(() => document.querySelector('meta[name=theme-color]')?.content);
  console.log(`   ようこそ画面 theme-color=${wel}（白いページ）`);
  await gp.click("text=カメラをはじめる"); await gp.waitForSelector(".cam .start [role=alert], .cam .deny, .cam-bot .lbl.stat"); await gp.waitForTimeout(500);
  const cam = await gp.evaluate(() => document.querySelector('meta[name=theme-color]')?.content);
  out("ようこそを過ぎたカメラ画面の theme-color が黒", /^#0|^#1|black/i.test(cam ?? ""), `host=${before} welcome=${wel} camera=${cam}`);
  await gp.close();
}
// 4. manifest / アイコン / installability
{
  const m = await (await fetch(`${WEB}/manifest.webmanifest`)).json();
  out("manifest 取得", m.start_url === "/host" && m.display === "standalone", `start_url=${m.start_url} display=${m.display}`);
  for (const i of m.icons) { const r = await fetch(WEB + i.src); out(`icon ${i.src} (${i.sizes}, ${i.purpose})`, r.status === 200 && (r.headers.get("content-type") ?? "").includes("image"), `${r.status} ${r.headers.get("content-type")}`); }
  const r = await fetch(`${WEB}/apple-touch-icon.png`); out("apple-touch-icon.png", r.status === 200, `${r.status}`);
  const html = await (await fetch(`${WEB}/host`)).text();
  out("head: manifest/apple メタ", /rel="manifest"/.test(html) && /apple-touch-icon/.test(html) && /apple-mobile-web-app-capable|mobile-web-app-capable/.test(html), (html.match(/<meta name="(?:apple|mobile)[^>]*>/g) ?? []).join(" "));
  const c = await browser.newContext({ viewport: { width: 375, height: 700 } });
  const pg = await c.newPage();
  await pg.goto(`${WEB}/host`);
  const cdp = await c.newCDPSession(pg);
  await cdp.send("Page.enable");
  const r2 = await cdp.send("Page.getInstallabilityErrors");
  const man = await cdp.send("Page.getAppManifest");
  out("installability エラーなし", r2.installabilityErrors.length === 0, JSON.stringify(r2.installabilityErrors.map((e) => e.errorId)));
  out("manifest の解析エラーなし", (man.errors ?? []).length === 0, JSON.stringify(man.errors ?? []));
}
// 5. コンソールエラー
out("ホスト操作中のコンソールエラーなし", p.errors.length === 0 && q2.errors.length === 0, [...p.errors, ...q2.errors].slice(0, 3).join(" | "));
await browser.close();
console.log(ng ? `${ng} 件 NG` : "ALL OK");
process.exit(ng ? 1 : 0);
