// T17 の確認: マイイベントの「リンクで追加」と、ハッシュ #t= の検証。実 API(:8787) + 実 API 向けの web(:5173)。ローカルのみ。
import { chromium } from "playwright";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const J = { "Content-Type": "application/json" };
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
let ng = 0;
const out = (n, ok, d = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${n}${d ? " : " + d : ""}`); };
const browser = await chromium.launch();
const errors = [];
const mk = async () => {
  const c = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error" && !/401|Unauthorized|403/.test(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push("pageerror " + e.message));
  return p;
};
const noH = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll(".host,.dialog")].every((e) => e.scrollWidth <= e.clientWidth));
const snap = async (p, n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${SHOT}host-link-${n}.png` }); };
const mkEv = async (name) => (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name, shotLimit: 27 }) })).json();
const payloadOf = (arr) => Buffer.from(JSON.stringify(arr), "utf8").toString("base64url");
const dates = ["2026-06-21T12:00:00+09:00", "2026-08-02T12:00:00+09:00", "2026-09-14T12:00:00+09:00"];
const entries = (evs) => evs.map((e, i) => ({ id: e.id, t: e.hostToken, name: e.name, createdAt: dates[i] }));
const messy = (s) => s.replace(/(.{37})/g, "$1\n  ").replace(/^(.{10})/, "$1 \t");   // 途中に改行・空白・タブ
const openAdd = async (p, empty = false) => { await p.goto(`${WEB}/host`); await p.waitForSelector(empty ? ".empty" : ".evcard"); await p.click("button:has-text('リンクで追加')"); await p.waitForSelector("[role=dialog] textarea"); };
const paste = async (p, text) => { await p.fill("[role=dialog] textarea", text); await p.click("[role=dialog] button:has-text('追加する')"); };

const names3 = ["ガーデンBBQ", "誕生日パーティー", "ウェディングパーティー"];

// ---- 4. 空の状態に「リンクで追加」・モーダルの見た目
{
  const p = await mk();
  await p.goto(`${WEB}/host`); await p.waitForSelector(".empty");
  out("空の画面に「リンクで追加」がある", (await p.locator(".empty button:has-text('リンクで追加')").count()) === 1);
  await snap(p, "01-empty");
  out("空の画面 横スクロールなし", await noH(p));
  await p.click("button:has-text('リンクで追加')"); await p.waitForSelector("[role=dialog] textarea");
  await p.fill("[role=dialog] textarea", "https://event-camera.kom-commoc.workers.dev/host#import=" + "A".repeat(600));
  await snap(p, "02-modal-long");
  out("モーダル(長い入力) 横スクロールなし・はみ出さない", await noH(p));
  const box = await p.locator(".dialog").boundingBox();
  out("モーダルが画面内に収まる", box.x >= 0 && box.x + box.width <= 375 && box.y >= 0 && box.y + box.height <= 700, JSON.stringify(box));
  out("空欄だと「追加する」は押せない", await (async () => { await p.fill("[role=dialog] textarea", "  \n "); return p.locator("[role=dialog] button:has-text('追加する')").isDisabled(); })());
  await p.click("[role=dialog] button:has-text('キャンセル')");
  out("キャンセルで閉じる", (await p.locator("[role=dialog]").count()) === 0);
  await p.close();
}

// ---- 2a. 取り込み用リンク（途中に改行・空白）
{
  const evs = [await mkEv(names3[0]), await mkEv(names3[1]), await mkEv(names3[2])];
  await fetch(`${API}/events/${evs[0].id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${evs[0].hostToken}` } });
  const link = `${WEB}/host#import=${payloadOf(entries(evs))}`;
  const p = await mk();
  await p.goto(`${WEB}/host`); await p.waitForSelector(".empty"); await p.click("button:has-text('リンクで追加')");
  await p.fill("[role=dialog] textarea", messy(link));
  await snap(p, "03-modal-messy");
  await p.click("[role=dialog] button:has-text('追加する')");
  await p.waitForSelector(".evcard"); await p.waitForFunction(() => document.querySelectorAll(".evcard .chip").length === 3);
  out("(a) 改行・空白入りの取り込み用リンク → 3件追加", (await p.locator(".evcard").count()) === 3);
  out("(a) 新しい順", (await p.locator(".evname2").allInnerTexts()).join() === "ウェディングパーティー,誕生日パーティー,ガーデンBBQ", (await p.locator(".evname2").allInnerTexts()).join());
  out("(a) 過去の日付", (await p.locator(".evmeta span:first-child").allInnerTexts()).join() === "2026.09.14,2026.08.02,2026.06.21");
  const toast = await p.locator(".toast").innerText();
  out("(a) トースト「3件追加しました」", toast === "3件追加しました", toast);
  out("(a) モーダルが閉じる", (await p.locator("[role=dialog]").count()) === 0);
  await snap(p, "04-added");
  out("(a) 追加後 横スクロールなし", await noH(p));
  await p.locator(".evmain").nth(0).click(); await p.waitForURL(/\/host\/[0-9a-f]{8}$/); await p.waitForSelector("img.qr");
  out("(a) 追加したイベントの管理画面が開く", true);
  await p.close();
}

// ---- 2b. 管理用リンク（名前が補完される）
{
  const e = await mkEv("管理リンクのイベント");
  const p = await mk();
  await openAdd(p, true).catch(async () => { await p.goto(`${WEB}/host`); await p.waitForSelector(".empty"); await p.click("button:has-text('リンクで追加')"); });
  await paste(p, `${WEB}/host/${e.id}#t=${e.hostToken}`);
  await p.waitForSelector(".evcard");
  await p.waitForFunction(() => document.querySelectorAll(".evcard .chip").length === 1);
  out("(b) 管理用リンク → 1件追加し、名前が入る", (await p.locator(".evname2").innerText()) === "管理リンクのイベント", await p.locator(".evname2").innerText());
  out("(b) トースト「1件追加しました」", (await p.locator(".toast").innerText()) === "1件追加しました");
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /myEvents|my-events|ec\.my/i.test(k)) ?? "") ?? "[]"));
  out("(b) 保存された名前も補完されている", saved.length === 1 && saved[0].name === "管理リンクのイベント", JSON.stringify(saved));
  // 管理用リンクに改行・%0A・%20 が混ざっても読める
  const e2 = await mkEv("改行入り管理リンク");
  await p.click("button:has-text('リンクで追加')");
  await paste(p, `  ${WEB}/host/${e2.id}\n#t=${e2.hostToken.slice(0, 10)}%0A %20${e2.hostToken.slice(10)}  \n`);
  await p.waitForFunction(() => document.querySelectorAll(".evcard").length === 2);
  out("(b) 改行・%0A・%20 入りの管理用リンクも追加できる", (await p.locator(".evcard").count()) === 2);
  // 重複して貼っても増えない
  await p.click("button:has-text('リンクで追加')");
  await paste(p, `${WEB}/host/${e.id}#t=${e.hostToken}`);
  await p.waitForTimeout(800);
  out("(b) 同じリンクを再度貼っても重複しない", (await p.locator(".evcard").count()) === 2, `${await p.locator(".evcard").count()}`);
  await p.close();
}

// ---- 2c. ペイロードのみ
{
  const evs = [await mkEv("ペイロードA"), await mkEv("ペイロードB")];
  const p = await mk();
  await p.goto(`${WEB}/host`); await p.waitForSelector(".empty"); await p.click("button:has-text('リンクで追加')");
  await paste(p, messy(payloadOf(entries(evs))));
  await p.waitForFunction(() => document.querySelectorAll(".evcard .chip").length === 2);
  out("(c) ペイロード単体 → 2件追加", (await p.locator(".toast").innerText()) === "2件追加しました", await p.locator(".toast").innerText());
  await p.close();
}

// ---- 2d. 有効 + 無効トークン混在
{
  const evs = [await mkEv("混在OK1"), await mkEv("混在NG"), await mkEv("混在OK2")];
  const arr = entries(evs); arr[1].t = "wrong-token-000";
  const p = await mk();
  await p.goto(`${WEB}/host`); await p.waitForSelector(".empty"); await p.click("button:has-text('リンクで追加')");
  await paste(p, `${WEB}/host#import=${payloadOf(arr)}`);
  await p.waitForSelector(".toast");
  const t = await p.locator(".toast").innerText();
  out("(d) 一部成功トースト", t === "2件追加しました。1件は確認できませんでした", t);
  await p.waitForFunction(() => document.querySelectorAll(".evcard").length === 2);
  const nm = (await p.locator(".evname2").allInnerTexts()).join();
  out("(d) 無効なものは一覧に入らない", !nm.includes("混在NG") && nm.includes("混在OK1") && nm.includes("混在OK2"), nm);
  out("(d) 無効なトークンは保存されない", (await p.evaluate((id) => localStorage.getItem(`ec.hostToken.${id}`), evs[1].id)) === null);
  await snap(p, "05-partial");
  // 全部無効
  await p.click("button:has-text('リンクで追加')");
  await paste(p, `${WEB}/host/${evs[1].id}#t=wrong-token-000`);
  await p.waitForSelector("[role=alert]");
  out("(d) 全て無効 → モーダル内にエラー、閉じない", (await p.locator("[role=dialog] [role=alert]").innerText()).includes("確認できませんでした") && (await p.locator("[role=dialog]").count()) === 1);
  await snap(p, "06-all-invalid");
  await p.close();
}

// ---- 2e. ゴミ
{
  const p = await mk();
  await p.goto(`${WEB}/host`); await p.waitForSelector(".empty"); await p.click("button:has-text('リンクで追加')");
  for (const g of ["ほげほげ hello world", "https://example.com/foo", "#import=!!!", "{\"id\":1}", "%%%"]) {
    await paste(p, g);
    await p.waitForSelector("[role=dialog] [role=alert]");
    const msg = await p.locator("[role=dialog] [role=alert]").innerText();
    out(`(e) ゴミ「${g}」→ モーダル内エラー`, msg.includes("読み取れませんでした") && (await p.locator("[role=dialog]").count()) === 1 && (await p.locator(".evcard").count()) === 0, msg);
  }
  await snap(p, "07-garbage");
  out("(e) エラー表示でも横スクロールなし", await noH(p));
  await p.close();
}

// ---- 3. ハッシュの管理用リンクの検証
{
  const e = await mkEv("ハッシュ検証");
  // 3a. 有効なトークン保存済みの端末で、間違ったハッシュ
  const p = await mk();
  await p.goto(`${WEB}/host`);
  await p.evaluate(([id, t]) => localStorage.setItem(`ec.hostToken.${id}`, t), [e.id, e.hostToken]);
  await p.goto(`${WEB}/host/${e.id}#t=wrong`);
  await p.waitForSelector("img.qr"); await p.waitForTimeout(1200);
  out("3a. 保存済みの有効トークン + #t=wrong → 管理画面が使える", (await p.locator("h1").first().innerText()) === "ハッシュ検証" && (await p.locator("text=ホストの権限がありません").count()) === 0);
  out("3a. 保存済みトークンは消えない", (await p.evaluate((id) => localStorage.getItem(`ec.hostToken.${id}`), e.id)) === e.hostToken);
  out("3a. ハッシュが URL から消える", !p.url().includes("#t="), p.url());
  await p.click("button:has-text('現像する')"); await p.click("[role=dialog] button:has-text('現像する')");
  await p.waitForSelector("text=現像済み", { timeout: 8000 }).catch(() => {});
  const st = await (await fetch(`${API}/events/${e.id}`)).json();
  out("3a. 現像できる（権限が有効）", st.status === "published", st.status);
  await snap(p, "08-hash-wrong-valid-saved");
  await p.goto(`${WEB}/host`); await p.waitForTimeout(1000);
  const inList = (await p.locator(".evcard").count()) > 0;
  console.log(`   (参考) 3a: トークン保存済みで #t=wrong を開いたあと、一覧に: ${inList ? "入る（保存済みトークンで管理画面が読めたため）" : "入らない"}`);
  await p.close();
  // 3b. トークンなしの端末
  const e3 = await mkEv("ハッシュ検証2");
  const q = await mk();
  await q.goto(`${WEB}/host/${e3.id}#t=wrong`);
  await q.waitForSelector("text=ホストの権限がありません"); await q.waitForTimeout(1200);
  out("3b. トークンなし + #t=wrong → トークン入力画面", (await q.locator("text=ホストの権限がありません").count()) === 1 && (await q.locator("img.qr").count()) === 0);
  out("3b. ハッシュが URL から消える", !q.url().includes("#t="), q.url());
  out("3b. トークンは保存されない", (await q.evaluate((id) => localStorage.getItem(`ec.hostToken.${id}`), e3.id)) === null);
  await snap(q, "09-hash-wrong-nosaved");
  await q.goto(`${WEB}/host`); await q.waitForSelector(".empty");
  out("3b. 一覧に追加されない（空のまま）", (await q.locator(".evcard").count()) === 0);
  // 3c. 正しいハッシュ
  await q.goto(`${WEB}/host/${e3.id}#t=${e3.hostToken}`); await q.waitForSelector("img.qr");
  await q.goto(`${WEB}/host`); await q.waitForSelector(".evcard");
  out("3c. 正しい #t= なら管理画面が開き、一覧に入る", (await q.locator(".evcard").count()) === 1);
  await q.close();
}

out("コンソールエラーなし（401 を除く）", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
console.log(ng ? `${ng} 件 NG` : "ALL OK");
process.exit(ng ? 1 : 0);
