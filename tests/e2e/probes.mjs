// デモを壊しそうな点の確認（実 API + vite 実 API モードが必要）。結果は console に出る。
import { chromium } from "playwright";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const J = { "Content-Type": "application/json" };
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
const mk = async (n, lim) => (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name: n, shotLimit: lim }) })).json();
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = async (cam) => (await browser.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true, permissions: cam ? ["camera"] : [] })).newPage();

// A: ホスト画面の一覧が、撮影直後(枠確保済み・PUT 前)の写真を取りこぼさないか
{
  const ev = await mk("probe A", 5);
  const host = await ctx();
  await host.addInitScript(([i, t]) => localStorage.setItem(`ec.hostToken.${i}`, t), [ev.id, ev.hostToken]);
  await host.goto(`${WEB}/host/${ev.id}`);
  await host.waitForSelector("img.qr");
  const s = await (await fetch(`${API}/events/${ev.id}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId: "probe-guest-1" }) })).json();
  await host.waitForTimeout(5500); // 枠だけ確保された状態でホスト側がポーリング
  await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPEG }); // その後アップロード完了
  await host.waitForTimeout(9000);
  const stat = await host.locator(".stats b").allInnerTexts();
  const n = await host.locator(".thumbs img").count();
  console.log(`A) 撮影枚数表示=${stat[1]} / 写真一覧の枚数=${n} (期待: 1 / 1)`, n === 1 ? "OK" : "NG: 一覧が古いまま");
  await host.close();
}
// B: ゲストが撮影中にホストが現像した場合、画面が切りかわるか
{
  const ev = await mk("probe B", 5);
  const g = await ctx(true);
  await g.goto(`${WEB}/e/${ev.id}`);
  await g.click("text=カメラをはじめる");
  await g.waitForSelector(".cam-bot .lbl.stat:has-text('撮影できます')");
  await fetch(`${API}/events/${ev.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${ev.hostToken}` } });
  await g.waitForTimeout(12000);
  const still = await g.locator(".cam").count();
  console.log(`B) 現像後12秒経ってもカメラ画面のまま? ${still ? "はい (NG: 自動で切りかわらない)" : "いいえ (OK)"}`);
  await g.click("button.shutter");
  await g.waitForTimeout(4000);
  console.log("   撮影後の画面:", (await g.locator(".vf-toast").allInnerTexts()).join("|") || "(toastなし)", "/ カウンター:", await g.locator(".roll").first().innerText());
  await g.screenshot({ path: new URL("../screenshots/probe-B-camera-after-publish.png", import.meta.url).pathname });
  await g.close();
}
// C: アップロード失敗(API 停止相当=PUT を中断)のとき、ゲストに分かるか・枠はどうなるか
{
  const ev = await mk("probe C", 3);
  const g = await ctx(true);
  await g.route("**/api/uploads/**", (r) => r.abort());
  await g.goto(`${WEB}/e/${ev.id}`);
  await g.click("text=カメラをはじめる");
  await g.waitForSelector(".cam-bot .lbl.stat:has-text('撮影できます')");
  await g.click("button.shutter");
  await g.waitForSelector(".vf-toast", { timeout: 20000 }).catch(() => {});
  const toast = await g.locator(".vf-toast").allInnerTexts();
  const info = await (await fetch(`${API}/events/${ev.id}`)).json();
  console.log(`C) PUT 失敗時の表示="${toast.join("|")}" / API の枠=${info.stats.photos} (写真一覧=0 になるはず)`);
  await g.close();
}
// D: 撮影の途中でリロード → 残り枚数が復元されるか
{
  const ev = await mk("probe D", 4);
  const g = await ctx(true);
  await g.goto(`${WEB}/e/${ev.id}`);
  await g.click("text=カメラをはじめる");
  await g.waitForSelector(".cam-bot .lbl.stat:has-text('撮影できます')");
  await g.click("button.shutter");
  await g.waitForTimeout(2500);
  await g.reload();
  await g.waitForSelector(".cam");
  console.log("D) 1枚撮ってリロード後の残り:", (await g.locator(".roll").first().innerText()).trim(), "(期待 03) / カメラは再許可のためボタン表示:", await g.locator("text=カメラをはじめる").count());
  await g.close();
}
await browser.close();
