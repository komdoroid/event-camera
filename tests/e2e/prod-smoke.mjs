// 本番の読み取り中心スモーク。確認用イベントを1つだけ作り、小さな JPEG を3枚上げて現像し、アルバムを表示する。
import { chromium } from "playwright";
const WEB = "https://event-camera.kom-commoc.workers.dev", API = "https://event-camera-api.kom-commoc.workers.dev/api";
const J = { "Content-Type": "application/json" };
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
let ng = 0;
const out = (n, ok, d = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${n}${d ? " : " + d : ""}`); };

const ev = await (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name: "QA確認（削除予定）", shotLimit: 5 }) })).json();
out("本番 API でイベント作成", !!ev.id, `id=${ev.id}`);
for (let i = 0; i < 3; i++) {
  const s = await (await fetch(`${API}/events/${ev.id}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId: "qa-prod-guest-1" }) })).json();
  const r = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG });
  out(`本番 PUT ${i + 1}枚目`, r.status === 204, `${r.status}`);
}
// 現像前のアルバム/画像
const pre = await fetch(`${API}/events/${ev.id}/album`);
out("本番 現像前のアルバムは 403", pre.status === 403, `${pre.status}`);
const cors = await fetch(`${API}/events/${ev.id}`, { headers: { Origin: WEB } });
out("本番 CORS: フロントの Origin を許可", cors.headers.get("access-control-allow-origin") === WEB, `${cors.headers.get("access-control-allow-origin")}`);
const pf = await fetch(`${API}/events/${ev.id}/shots`, { method: "OPTIONS", headers: { Origin: WEB, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
out("本番 CORS プリフライト", pf.headers.get("access-control-allow-origin") === WEB, `${pf.status}`);
const pub = await fetch(`${API}/events/${ev.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${ev.hostToken}` } });
out("本番 現像", pub.status === 200, `${pub.status}`);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
const hs = async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

await page.goto(`${WEB}/host/new`); await page.waitForSelector("h1");
await page.waitForTimeout(800);
out("本番 /host/new が表示され、横スクロールなし", (await page.locator("h1").innerText()).includes("イベント") && (await hs()));
await page.screenshot({ path: `${SHOT}prod-host-new.png` });

await page.goto(`${WEB}/e/${ev.id}`); await page.waitForSelector("text=ひらく");
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOT}prod-guest-announce.png` });
await page.click("text=ひらく"); await page.waitForSelector(".dpage.cover img");
await page.waitForTimeout(2000);
const broken = await page.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).length);
out("本番 アルバム表示・画像が壊れていない", broken === 0, `壊れた画像=${broken}, ページ数=${await page.locator(".dpage").count()}`);
out("本番 アルバムで横スクロールなし", await hs());
await page.screenshot({ path: `${SHOT}prod-guest-album.png` });
await page.click("text=えらぶ"); await page.waitForSelector(".buy");
await page.screenshot({ path: `${SHOT}prod-guest-buy.png` });
await page.locator(".hcard button").first().click(); await page.waitForSelector("text=ありがとう");
out("本番 購入（モック）完了", (await page.locator("body").innerText()).includes("¥500"));
await page.screenshot({ path: `${SHOT}prod-guest-done.png` });

// ホスト（管理用リンク）
await page.goto(`${WEB}/host/${ev.id}#t=${ev.hostToken}`); await page.waitForSelector("img.qr");
await page.waitForSelector(".thumbs img"); await page.locator(".thumbs img").first().scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
const bt = await page.evaluate(() => [...document.querySelectorAll(".thumbs img")].filter((i) => !(i.complete && i.naturalWidth > 0)).length);
out("本番 ホスト管理画面（管理用リンク）・サムネイル", bt === 0, `壊れ=${bt}`);
await page.screenshot({ path: `${SHOT}prod-host-event.png`, fullPage: true });
const qrurl = await page.locator(".urlbox").innerText();
out("本番 QR の URL が本番フロントの URL", qrurl.startsWith(WEB + "/e/"), qrurl);
// SPA の直リンク（_redirects 削除後も /e/:id /host/:id が直接開けること）は上の goto で確認済み
const nf = await page.goto(`${WEB}/no/such/path`);
out("本番 未知のパスもアプリが返す(SPA fallback)", nf.status() === 200, `${nf.status()}`);
out("本番 コンソールエラーなし", errors.length === 0, errors.slice(0, 3).join(" | "));
// 画像ヘッダ
const ph = await fetch((await (await fetch(`${API}/events/${ev.id}/album`)).json()).pages[0].photos[0].url);
out("本番 画像応答ヘッダ nosniff/CSP", ph.headers.get("x-content-type-options") === "nosniff" && ph.headers.get("content-security-policy") === "default-src 'none'");
await browser.close();
console.log("EVENT_ID=" + ev.id);
process.exit(ng ? 1 : 0);
