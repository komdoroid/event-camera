// ブラウザ確認。MODE=mock: VITE_USE_MOCK_API=1 の vite (:5173) に対して。MODE=real: 実 API(:8787) + vite(:5173)。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const MODE = process.env.MODE ?? "mock";
const WEB = "http://localhost:5173";
const API = "http://localhost:8787/api";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "OK " : "NG "} ${name}${detail ? " : " + detail : ""}`); };

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });

async function newCtx(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: opts.cam ? ["camera"] : [], ...opts.ctx });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return { ctx, page, errors };
}
const noHscroll = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
async function snap(page, name, errors, { full = false } = {}) {
  await page.waitForTimeout(400);
  const { sw, cw } = await noHscroll(page);
  // 内側のスクロール容器 (.diary) も見る
  const inner = await page.evaluate(() => [...document.querySelectorAll(".diary,.host,.cam")].map((e) => e.scrollWidth - e.clientWidth).filter((d) => d > 0));
  await page.screenshot({ path: `${OUT}${MODE}-${name}.png`, fullPage: full });
  check(`[${MODE}] ${name}: 横スクロールなし`, sw <= cw && inner.length === 0, `scrollWidth=${sw} clientWidth=${cw} inner=${JSON.stringify(inner)}`);
}
const finish = (name, errors) => check(`[${MODE}] ${name}: コンソールエラーなし`, errors.length === 0, errors.slice(0, 3).join(" | "));

// ---- ホスト: 作成 -> 管理画面
let hostEventId = null, hostToken = null;
{
  const { ctx, page, errors } = await newCtx();
  await page.goto(`${WEB}/host/new`);
  await snap(page, "host-new", errors);
  await page.fill('input[type=text], input:not([type])', "Kazuki & Misaki Wedding");
  await page.fill('input[type=number]', "5");
  await page.click("button.hbtn");
  await page.waitForURL((u) => /\/host\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/new"));
  hostEventId = page.url().split("/").pop();
  check(`[${MODE}] 作成 -> /host/:id へ遷移`, !!hostEventId, hostEventId);
  await page.waitForSelector("img.qr");
  hostToken = await page.evaluate((id) => localStorage.getItem(`ec.hostToken.${id}`), hostEventId);
  check(`[${MODE}] hostToken が localStorage に保存`, !!hostToken);
  await snap(page, "host-event", errors, { full: true });
  await page.click("text=全画面で表示");
  await snap(page, "host-fullqr", errors);
  await page.click(".overlay.full");
  // 再読み込みしても戻れる
  if (MODE === "real") await page.reload(); // モックはメモリ上なのでリロードで消える
  await page.waitForSelector("img.qr");
  check(`[${MODE}] 再読み込みで管理画面に戻れる`, (await page.locator("h1").first().innerText()).length > 0 && !(await page.locator("text=ホストの権限がありません").count()));
  if (MODE === "mock") await page.waitForSelector(".thumbs img");
  await page.click("button:has-text('現像する')");
  await page.waitForSelector("[role=dialog]");
  await snap(page, "host-publish-dialog", errors);
  await page.click("[role=dialog] button:has-text('やめる')");
  finish("ホスト作成〜管理", errors);
  // zip ダウンロード（実際に落ちて中身が zip か）
  if (MODE === "mock") {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.click("button:has-text('すべてダウンロード')")]);
    const p = await dl.path();
    const { readFileSync } = await import("node:fs");
    const buf = readFileSync(p);
    check(`[${MODE}] zip ダウンロード (PK ヘッダ)`, buf[0] === 0x50 && buf[1] === 0x4b, `${dl.suggestedFilename()} ${buf.length}B`);
  }
  await ctx.close();
}

// ---- ゲスト: カメラ画面
if (MODE === "mock") {
  const { ctx, page, errors } = await newCtx();
  await page.goto(`${WEB}/e/demo?limit=3`);
  await page.waitForSelector(".cam");
  await snap(page, "guest-camera-before-permission", errors);
  await ctx.close();
}
{
  // フェイクカメラで 撮影 -> 巻き上げ -> 撮り切り
  const { ctx, page, errors } = await newCtx({ cam: true });
  const id = MODE === "mock" ? "demo" : null;
  let eid = id;
  if (MODE === "real") {
    const r = await (await fetch(`${API}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Browser Test", shotLimit: 3 }) })).json();
    eid = r.id; globalThis.realEvent = r;
  }
  await page.goto(`${WEB}/e/${eid}${MODE === "mock" ? "?limit=3" : ""}`);
  await page.waitForSelector(".cam");
  let taps = 0;
  await page.click("text=カメラをはじめる"); taps++;
  await page.waitForSelector(".viewf video");
  await page.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("撮影できます"));
  await snap(page, "guest-camera-live", errors);
  await page.click("button.shutter"); taps++;
  check(`[${MODE}] 3タップ以内に1枚目 (タップ数=${taps})`, taps <= 3);
  await page.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("巻き上げ待ち"));
  check(`[${MODE}] 撮影後は「巻き上げ待ち」で、残りが 02`, (await page.locator(".roll").first().innerText()).includes("02"));
  // 巻き上げ前にシャッターしても減らない
  await page.click("button.shutter");
  await page.waitForTimeout(300);
  check(`[${MODE}] 巻き上げ前のシャッターは無効 (残り02のまま)`, (await page.locator(".roll").first().innerText()).includes("02"));
  const wind = async () => {
    const b = await page.locator(".wheel").boundingBox();
    const y = b.y + b.height / 2;
    await page.mouse.move(b.x + 20, y); await page.mouse.down();
    for (let x = 20; x < 300; x += 20) await page.mouse.move(b.x + x, y);
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector(".cam")?.dataset.wound === "1");
  };
  await wind();
  check(`[${MODE}] スワイプで巻き上げ完了`, true);
  await page.click("button.shutter"); await wind();
  await page.click("button.shutter");
  // 撮り切り -> 現像待ち
  await page.waitForSelector(".diary .screen", { timeout: 6000 });
  await snap(page, "guest-wait", errors);
  check(`[${MODE}] 撮り切ると現像待ち画面`, (await page.locator(".dtitle").innerText()).includes("3枚"));
  // リロードしても現像待ち
  if (MODE === "real") {
    await page.reload();
    await page.waitForSelector(".diary .screen");
    check(`[${MODE}] 再読み込みしても現像待ちが復元`, (await page.locator(".dtitle").innerText()).includes("3枚"));
  }
  finish("カメラ", errors);
  if (MODE === "real") {
    const ev = globalThis.realEvent;
    await page.waitForTimeout(500);
    const info = await (await fetch(`${API}/events/${ev.id}`)).json();
    check(`[real] 3枚が API 側に届いた`, info.stats.photos === 3, JSON.stringify(info.stats));
    const pl = await (await fetch(`${API}/events/${ev.id}/photos`, { headers: { Authorization: `Bearer ${ev.hostToken}` } })).json();
    check(`[real] 3枚ともアップロード済み(写真一覧)`, pl.photos.length === 3, `${pl.photos.length}`);
    // ホストが現像 -> ゲストの現像待ちが自動で切りかわる（5秒ポーリング）
    await fetch(`${API}/events/${ev.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${ev.hostToken}` } });
    try {
      await page.waitForSelector("text=とどきました", { timeout: 9000 });
      check(`[real] 現像待ち -> 発刊のお知らせへ自動で切りかわる`, true);
    } catch { check(`[real] 現像待ち -> 発刊のお知らせへ自動で切りかわる`, false, "9秒以内に切りかわらず"); }
    await snap(page, "guest-announce", errors);
    await page.click("text=ひらく");
    await page.waitForSelector(".dpage.cover img");
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
    const broken = await page.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).length);
    check(`[real] アルバムの画像がすべて表示される`, broken === 0, `壊れた画像=${broken}`);
    await snap(page, "guest-album-cover", errors);
    await page.click("text=えらぶ");
    await page.waitForSelector(".buy");
    await snap(page, "guest-buy", errors);
    await page.locator(".hcard button").first().click();
    await page.waitForSelector("text=ありがとう");
    await snap(page, "guest-done", errors);
    check(`[real] 購入完了に金額が出る`, (await page.locator("body").innerText()).includes("¥500"));
    finish("実APIゲスト", errors);
  }
  await ctx.close();
}

// ---- モック: 現像済み -> アルバム -> 購入 -> 完了
if (MODE === "mock") {
  const { ctx, page, errors } = await newCtx();
  await page.goto(`${WEB}/e/demo?status=published`);
  await page.waitForSelector("text=ひらく");
  await snap(page, "guest-announce", errors);
  await page.click("text=ひらく");
  await page.waitForSelector(".dpage.cover");
  await snap(page, "guest-album-cover", errors);
  await page.waitForTimeout(500);
  const h = await page.evaluate(() => document.querySelector(".diary").scrollHeight);
  await page.screenshot({ path: `${OUT}${MODE}-guest-album-full.png`, fullPage: true });
  // 各ページを順にスクショ
  const pages = await page.locator(".dpage").count();
  for (let i = 0; i < pages; i++) {
    await page.locator(".dpage").nth(i).scrollIntoViewIfNeeded();
    await page.locator(".dpage").nth(i).screenshot({ path: `${OUT}${MODE}-album-page-${String(i).padStart(2, "0")}.png` });
  }
  check(`[mock] アルバムのページ数 (${pages})`, pages >= 5, `scrollHeight=${h}`);
  const { sw, cw } = await noHscroll(page);
  // overflow:hidden で切られている装飾は除外
  const inner = await page.evaluate(() => [...document.querySelectorAll(".dpage")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "hidden").length);
  check(`[mock] アルバム全ページで横はみ出しなし`, sw <= cw && inner === 0, `sw=${sw} cw=${cw} overflowPages=${inner}`);
  await page.click("text=えらぶ");
  await page.waitForSelector(".buy");
  await snap(page, "guest-buy", errors);
  const prices = await page.locator(".price").allInnerTexts();
  check(`[mock] 購入画面に価格が2つ`, prices.length === 2, prices.join(","));
  await page.locator(".hcard button").nth(1).click();
  await page.waitForSelector("text=ありがとう");
  await snap(page, "guest-done", errors);
  check(`[mock] 完了画面に商品名と金額`, (await page.locator("body").innerText()).includes("¥3,000"));
  await page.click("text=アルバムにもどる");
  await page.waitForSelector(".dpage.cover");
  finish("アルバム〜購入", errors);
  await ctx.close();
}

// ---- 実 API: ホストが作成 -> API で写真 -> 現像(ホスト画面) -> ゲストアルバム
if (MODE === "real") {
  const { ctx, page, errors } = await newCtx();
  await page.goto(`${WEB}/host/new`);
  await page.fill('input:not([type])', "Real Host Flow");
  await page.fill('input[type=number]', "10");
  await page.click("button.hbtn");
  await page.waitForURL((u) => /\/host\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith("/new"));
  const id = page.url().split("/").pop();
  const token = await page.evaluate((i) => localStorage.getItem(`ec.hostToken.${i}`), id);
  const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
  for (const g of ["guest-host-flow-1", "guest-host-flow-2"]) for (let i = 0; i < 3; i++) {
    const s = await (await fetch(`${API}/events/${id}/shots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestId: g }) })).json();
    const r = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG });
    if (r.status !== 204) check("[real] seed upload", false, String(r.status));
  }
  await page.waitForFunction(() => document.querySelectorAll(".thumbs img").length === 6, null, { timeout: 12000 }).catch(() => {});
  const nthumb = await page.locator(".thumbs img").count();
  check(`[real] ホスト写真一覧に6枚 (現像前・token付きURL)`, nthumb === 6, `${nthumb}`);
  await page.locator(".thumbs").scrollIntoViewIfNeeded();
  for (let i = 0; i < 6; i++) await page.locator(".thumbs img").nth(i).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800); // loading="lazy" の読み込み待ち
  const brokenThumbs = await page.evaluate(() => [...document.querySelectorAll(".thumbs img")].filter((i) => !(i.complete && i.naturalWidth > 0)).length);
  check(`[real] ホストのサムネイルが壊れていない`, brokenThumbs === 0, `${brokenThumbs}`);
  await snap(page, "host-event-real", errors, { full: true });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.click("button:has-text('すべてダウンロード')")]);
  const { readFileSync } = await import("node:fs");
  const buf = readFileSync(await dl.path());
  check(`[real] zip ダウンロード (PK ヘッダ)`, buf[0] === 0x50 && buf[1] === 0x4b, `${buf.length}B`);
  await page.click("button:has-text('現像する')");
  await page.click("[role=dialog] button:has-text('現像する')");
  await page.waitForSelector("text=アルバムを見る");
  check(`[real] 現像後に「アルバムを見る」`, true);
  // 別端末（ゲスト）としてアルバム
  const g = await newCtx();
  await g.page.goto(`${WEB}/e/${id}`);
  await g.page.waitForSelector("text=ひらく");
  await g.page.click("text=ひらく");
  await g.page.waitForSelector(".dpage.cover img");
  await g.page.waitForTimeout(1000);
  const gb = await g.page.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).length);
  check(`[real] ゲストのアルバム画像が表示される`, gb === 0, `壊れた画像=${gb}`);
  await snap(g.page, "guest-album-real", g.errors);
  finish("ゲストアルバム(正常系)", g.errors);
  g.errors.length = 0; // 以下は意図的な異常系なので 403/404 のログは許容
  // 現像前のアルバムURL直アクセス
  const r2 = await fetch(`${API}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "unpub" }) }).then((r) => r.json());
  await g.page.goto(`${WEB}/e/${r2.id}/album`);
  await g.page.waitForSelector("text=まだ現像前です");
  check(`[real] 現像前に /album を開くと「まだ現像前」`, true);
  await snap(g.page, "guest-album-unpublished", g.errors);
  // 存在しないイベント
  await g.page.goto(`${WEB}/e/doesnotexist`);
  await g.page.waitForSelector("text=開けませんでした");
  check(`[real] 存在しないイベントでエラー画面`, true);
  // hostToken なし
  const h2 = await newCtx();
  await h2.page.goto(`${WEB}/host/${id}`);
  await h2.page.waitForSelector("text=この端末にはホストの権限がありません");
  await snap(h2.page, "host-no-token", h2.errors);
  finish("ホスト〜現像〜ゲストアルバム", errors);
  await ctx.close();
}

await browser.close();
const ng = results.filter((r) => !r.ok);
console.log(`\n${results.length - ng.length}/${results.length} OK`);
process.exit(ng.length ? 1 : 0);
