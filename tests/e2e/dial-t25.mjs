// T25: 巻き上げダイヤルの確認（mock の vite :5173）
import { chromium } from "playwright";
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const c = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["camera"] });
await c.addInitScript(() => { localStorage.setItem("ec.introSeen", "1"); localStorage.setItem("ec.installShown", "1"); });
const p = await c.newPage(); const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text())); p.on("pageerror", (e) => errors.push(e.message));
let ng = 0; const ok = (n, v, d = "") => { if (!v) ng++; console.log(`${v ? "OK " : "NG "} ${n} ${d}`); };
await p.goto("http://localhost:5173/e/demo?limit=8"); await p.waitForSelector(".cam");
await p.click("text=カメラをはじめる");
await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("撮影できます"));
const stat = () => p.evaluate(() => document.querySelector(".cam-bot .lbl.stat").textContent);
const bg = () => p.evaluate(() => document.querySelector(".dsvg").dataset.phase);
const wound = () => p.evaluate(() => document.querySelector(".cam").dataset.wound);
const snap = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `${SHOT}dial-${n}.png` }); };
await p.click("button.shutter");
await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("巻き上げ待ち"));
await snap("1-before");
// 巻き上げ前にシャッター: 残りは減らない
await p.click("button.shutter"); ok("巻き上げ前はシャッター無効", (await stat()).includes("巻き上げ待ち"));
const b = await p.locator(".wheel").boundingBox(); const y = b.y + b.height / 2;
await p.mouse.move(b.x + 20, y); await p.mouse.down();
const seen = [await bg()];
for (let x = 20; x <= 100; x += 20) { await p.mouse.move(b.x + x, y); seen.push(await bg()); }
await snap("2-during");
ok("スワイプで模様の位置が変わる", new Set(seen).size >= 4, JSON.stringify(seen));
for (let x = 120; x <= 300; x += 17) await p.mouse.move(b.x + x, y);
const atWound = await bg();
await p.mouse.move(b.x + 340, y); await p.mouse.move(b.x + 360, y);
ok("巻き切ったら回らない", (await bg()) === atWound, `${atWound} -> ${await bg()}`);
await p.mouse.up();
ok("巻き上げ完了", (await wound()) === "1" && (await stat()).includes("撮影できます"));
ok("READY 表示", (await p.locator(".wlabel").innerText()).includes("READY"));
await snap("3-after");
// 逆方向（左）でも巻ける
await p.click("button.shutter");
ok("撮影後は再び巻き上げが必要", (await wound()) === "0");
await p.mouse.move(b.x + 300, y); await p.mouse.down();
for (let x = 300; x >= 100; x -= 20) await p.mouse.move(b.x + x, y);
await p.mouse.up();
ok("左スワイプでも巻ける", (await wound()) === "1");
// ダイヤル自体のドラッグ
await p.click("button.shutter");
const d = await p.locator(".dial").boundingBox(); const dy = d.y + d.height / 2;
await p.mouse.move(d.x + 40, dy); await p.mouse.down();
for (let x = 40; x >= -160; x -= 20) await p.mouse.move(d.x + x, dy);
await p.mouse.up();
ok("ダイヤルのドラッグでも巻ける", (await wound()) === "1");
// キーボード
await p.waitForTimeout(50);
const sh = await p.locator("button.shutter").boundingBox(); const dl = await p.locator(".dial").boundingBox();
ok("ダイヤルとシャッターが重ならない", dl.x + dl.width <= 375 + 60 && !(dl.y < sh.y + sh.height && dl.y + dl.height > sh.y), JSON.stringify({ dl, sh }));
const sw = await p.evaluate(() => [document.documentElement.scrollWidth <= document.documentElement.clientWidth, document.querySelector(".cam").scrollWidth <= document.querySelector(".cam").clientWidth]);
ok("横スクロールなし", sw[0] && sw[1], JSON.stringify(sw));
ok("背景は黒", (await p.evaluate(() => getComputedStyle(document.querySelector(".cam")).backgroundColor)) !== "");
ok("コンソールエラーなし", errors.length === 0, errors.join("|"));
await browser.close(); process.exit(ng ? 1 : 0);
