// T14 の確認: ホストがダッシュボードから撮る / 既定イベント名 / 取り込み用リンク。
// 実 API(:8787) + 実 API 向けの web(:5173) が必要。ローカルのみ（本番には何も作らない）。
import { chromium } from "playwright";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const J = { "Content-Type": "application/json" };
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
let ng = 0;
const out = (n, ok, d = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${n}${d ? " : " + d : ""}`); };
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
const mk = async (cam = true) => {
  const c = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: cam ? ["camera"] : [] });
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push("pageerror " + e.message));
  return p;
};
const noH = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll(".host,.cam,.diary")].every((e) => e.scrollWidth <= e.clientWidth));
const snap = async (p, n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${SHOT}host-shoot-${n}.png` }); };
const stat = (p) => p.evaluate(() => [...document.querySelectorAll(".stats b")].map((b) => b.textContent));
async function shoot(p, first) {
  if (first) await p.click("text=カメラをはじめる");
  await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("撮影できます"));
  await p.click("button.shutter");
  await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("巻き上げ待ち"));
}
async function wind(p) {
  const b = await p.locator(".wheel").boundingBox(); const y = b.y + b.height / 2;
  await p.mouse.move(b.x + 20, y); await p.mouse.down();
  for (let x = 20; x < 300; x += 20) await p.mouse.move(b.x + x, y);
  await p.mouse.up();
  await p.waitForFunction(() => document.querySelector(".cam")?.dataset.wound === "1");
}

// ---- 3. 名前を空のまま作ると「ウェディングパーティー」 + 1. わたしも撮る
const host = await mk();
await host.goto(`${WEB}/host/new`); await host.waitForSelector("form");
out("/host/new の placeholder が「ウェディングパーティー」", (await host.locator('input:not([type])').getAttribute("placeholder")) === "ウェディングパーティー");
await host.fill('input[type=number]', "5");
await host.click("form button.hbtn");
await host.waitForURL((u) => /\/host\/[0-9a-f]{8}$/.test(u.pathname));
const id = host.url().split("/").pop();
await host.waitForSelector("img.qr");
out("名前が空でも作れて、イベント名が「ウェディングパーティー」", (await host.locator("h1").first().innerText()) === "ウェディングパーティー", await host.locator("h1").first().innerText());
const info = await (await fetch(`${API}/events/${id}`)).json();
out("API 側のイベント名も「ウェディングパーティー」", info.name === "ウェディングパーティー", info.name);
await host.fill('input[type=text]', "").catch(() => {});
// 空白だけの名前でも既定名になる
await host.goto(`${WEB}/host/new`); await host.fill('input:not([type])', "   "); await host.click("form button.hbtn");
await host.waitForURL((u) => /\/host\/[0-9a-f]{8}$/.test(u.pathname) && !u.pathname.endsWith(id)); await host.waitForSelector("img.qr");
out("空白だけの名前でも既定名", (await host.locator("h1").first().innerText()) === "ウェディングパーティー");
// 一覧にも既定名で入る
await host.goto(`${WEB}/host/${id}`); await host.waitForSelector("img.qr");

const btn = host.locator("a.hbtn.shoot");
out("ダッシュボードに「わたしも撮る」ボタン", (await btn.count()) === 1 && (await btn.innerText()).trim() === "わたしも撮る", await btn.allInnerTexts().then((a) => a.join()));
await snap(host, "01-dashboard");
out("ダッシュボード 横スクロールなし", await noH(host));
const before = await stat(host);
await btn.click();
await host.waitForURL(`${WEB}/e/${id}`);
await host.waitForSelector(".cam");
out("「わたしも撮る」でカメラ画面 /e/:id へ", true);
const back = host.locator(".cam-top a.hostback");
out("カメラ画面(ホスト)に「管理画面へ」が出る", (await back.count()) === 1 && (await back.innerText()).trim() === "管理画面へ");
await snap(host, "02-camera-host");
await shoot(host, true); await wind(host); await shoot(host, false);
out("2枚撮影できた", (await host.locator(".roll").first().innerText()).includes("03"), await host.locator(".roll").first().innerText());
await host.waitForTimeout(1500); // アップロード完了待ち
await host.click(".cam-top a.hostback");
await host.waitForURL(`${WEB}/host/${id}`); await host.waitForSelector("img.qr");
out("「管理画面へ」でダッシュボードに戻る", true);
await host.waitForFunction(() => document.querySelectorAll(".stats b")[1]?.textContent === "2", null, { timeout: 8000 }).catch(() => {});
const after = await stat(host);
out("撮影枚数が増えている", Number(after[1]) === Number(before[1]) + 2, `before=${before} after=${after}`);
out("参加ゲストが1人になる", after[0] === "1", `${after}`);
await snap(host, "03-dashboard-after");

// ---- 2. ゲスト(トークンなし)には「管理画面へ」が出ない
const guest = await mk();
await guest.goto(`${WEB}/e/${id}`); await guest.waitForSelector(".cam");
await guest.click("text=カメラをはじめる"); await guest.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("撮影できます"));
out("ゲスト: カメラ画面に「管理画面へ」が出ない", (await guest.locator("text=管理画面へ").count()) === 0 && (await guest.locator(".hostback").count()) === 0);
await snap(guest, "04-camera-guest");
out("ゲストの端末に hostToken がない", (await guest.evaluate((i) => localStorage.getItem(`ec.hostToken.${i}`), id)) === null);
// 撮り切りのゲスト（待ち画面）にも出ない: limit 1 のイベント
const e1 = await (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name: "One Shot", shotLimit: 1 }) })).json();
const g2 = await mk(); await g2.goto(`${WEB}/e/${e1.id}`); await g2.waitForSelector(".cam");
await g2.click("text=カメラをはじめる"); await g2.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("撮影できます")); await g2.click("button.shutter");
await g2.waitForTimeout(3000);
out("ゲスト: 撮り切り後の待ち画面にも出ない", (await g2.locator("text=管理画面へ").count()) === 0, (await g2.locator("body").innerText()).replace(/\n/g, " ").slice(0, 80));
// ホスト: 撮り切り後の待ち画面には出る
const h2 = await mk(); await h2.goto(`${WEB}/host/${e1.id}#t=${e1.hostToken}`); await h2.waitForSelector("img.qr");
await h2.goto(`${WEB}/e/${e1.id}`); await h2.waitForTimeout(1500);
out("ホスト: 撮り切り(待ち)画面に「管理画面へ」が出る", (await h2.locator("a.hostback").count()) === 1, (await h2.locator("body").innerText()).replace(/\n/g, " ").slice(0, 80));
await snap(h2, "05-wait-host");

// ---- 5. 上部バーの重なり: 長い名前 + 送信中表示 + 管理画面へ
const e2 = await (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name: "とても長いイベントの名前をつけたウェディングパーティー二次会の写真", shotLimit: 5 }) })).json();
const h3 = await mk();
await h3.goto(`${WEB}/host/${e2.id}#t=${e2.hostToken}`); await h3.waitForSelector("img.qr");
await h3.route("**/api/uploads/**", async (r) => { await new Promise((s) => setTimeout(s, 6000)); await r.continue().catch(() => {}); });
await h3.goto(`${WEB}/e/${e2.id}`); await h3.waitForSelector(".cam");
await shoot(h3, true);
await h3.waitForSelector(".cam-top .sending");
const boxes = await h3.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; }; return { name: r(".cam-top .evname"), send: r(".cam-top .sending"), back: r(".cam-top .hostback"), top: r(".cam-top"), vw: innerWidth }; });
const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
out("上部バー: 「送信中」と「管理画面へ」が重ならない", !hit(boxes.send, boxes.back), JSON.stringify(boxes));
out("上部バー: イベント名と「管理画面へ」が重ならない", !hit(boxes.name, boxes.back));
out("上部バー: イベント名と「送信中」が重ならない", !hit(boxes.name, boxes.send));
out("上部バー: 画面の外にはみ出さない", boxes.back.r <= boxes.vw && boxes.send.r <= boxes.vw && boxes.name.l >= 0);
out("カメラ画面(ホスト) 横スクロールなし", await noH(h3));
await snap(h3, "06-camera-sending");

// ---- 公開後: 「アルバムを見る」
await fetch(`${API}/events/${id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${(await host.evaluate((i) => localStorage.getItem(`ec.hostToken.${i}`), id))}` } });
await host.goto(`${WEB}/host/${id}`); await host.waitForSelector("img.qr");
const btn2 = host.locator("a.hbtn.shoot");
out("現像後はボタンが「アルバムを見る」", (await btn2.innerText()).trim() === "アルバムを見る", await btn2.innerText());
await snap(host, "07-dashboard-published");
await btn2.click();
await host.waitForURL(`${WEB}/e/${id}/album`);
await host.waitForSelector(".dpage");
out("「アルバムを見る」で /e/:id/album が開く", true);
// 現像後に /e/:id を開くと(ホスト) 絵日記の案内 + 管理画面へ
await host.goto(`${WEB}/e/${id}`); await host.waitForSelector("text=ひらく");
out("ホスト: 現像後の案内画面に「管理画面へ」", (await host.locator("a.hostback").count()) === 1);
await snap(host, "08-announce-host");
out("案内画面 横スクロールなし", await noH(host));

// ---- 4. 取り込み用リンク
const mkEv = async (name) => (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify({ name, shotLimit: 27 }) })).json();
const evs = [await mkEv("ガーデンBBQ"), await mkEv("誕生日パーティー"), await mkEv("ウェディングパーティー")];
await fetch(`${API}/events/${evs[0].id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${evs[0].hostToken}` } });
const dates = ["2026-06-21T12:00:00+09:00", "2026-08-02T12:00:00+09:00", "2026-09-14T12:00:00+09:00"];
const payloadOf = (arr) => Buffer.from(JSON.stringify(arr), "utf8").toString("base64url");
const payload = payloadOf(evs.map((e, i) => ({ id: e.id, t: e.hostToken, name: e.name, createdAt: dates[i] })));
out("payload にパディング(=)がない", !payload.includes("="));
const imp = await mk(false);
await imp.goto(`${WEB}/host#import=${payload}`);
await imp.waitForSelector(".evcard");
await imp.waitForFunction(() => document.querySelectorAll(".evcard .chip").length === 3);
out("取り込み: 3件が一覧に出る", (await imp.locator(".evcard").count()) === 3);
const names = await imp.locator(".evname2").allInnerTexts();
out("新しい順（9/14 → 8/2 → 6/21）", names.join() === "ウェディングパーティー,誕生日パーティー,ガーデンBBQ", names.join());
const dts = await imp.locator(".evmeta span:first-child").allInnerTexts();
out("日付表示が 2026.09.14 / 2026.08.02 / 2026.06.21", dts.join() === "2026.09.14,2026.08.02,2026.06.21", dts.join());
const toast = await imp.locator(".toast[role=status]").innerText().catch(() => "");
out("トーストが出る（3件）", toast.includes("3件"), toast);
await snap(imp, "09-import");
out("ハッシュが URL から消える", new URL(imp.url()).hash === "" && !imp.url().includes("import"), imp.url());
out("取り込み後 横スクロールなし", await noH(imp));
const st = await imp.locator(".evlist").innerText();
out("現像済み/撮影中のチップ", st.includes("現像済み") && st.includes("撮影中"));
await imp.waitForTimeout(4500);
out("トーストが数秒で消える", (await imp.locator(".toast").count()) === 0);
// リロードしても残る・トーストは再表示されない
await imp.reload(); await imp.waitForSelector(".evcard");
out("リロード後も3件残り、トーストは出ない", (await imp.locator(".evcard").count()) === 3 && (await imp.locator(".toast").count()) === 0);
// 各イベントの管理画面が開く
for (let i = 0; i < 3; i++) {
  await imp.goto(`${WEB}/host`); await imp.waitForSelector(".evcard");
  await imp.locator(".evmain").nth(i).click();
  await imp.waitForURL(/\/host\/[0-9a-f]{8}$/); await imp.waitForSelector("img.qr");
  const h1 = await imp.locator("h1").first().innerText();
  const denied = await imp.locator("text=ホストの権限がありません").count();
  const shootBtn = await imp.locator("a.hbtn.shoot").innerText();
  out(`取り込んだイベント${i + 1}の管理画面が開く`, h1 === names[i] && denied === 0, `${h1} / ${shootBtn}`);
}
// 取り込みで入ったトークンで現像できる（権限が有効）
const chk = await fetch(`${API}/events/${evs[1].id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${evs[1].hostToken}` } });
out("取り込んだトークンは有効（API で現像できる）", chk.status === 200, `${chk.status}`);

// 不正な payload
const bads = { "でたらめ": "!!!not-base64!!!", "JSONでない": Buffer.from("hello").toString("base64url"), "配列でない": payloadOf({ a: 1 }), "要素が不正": payloadOf([null, 1, "x", { id: 1 }, { id: "a" }]), "空": "", "巨大": "A".repeat(100000) };
for (const [k, v] of Object.entries(bads)) {
  const bp = await mk(false); const errs0 = errors.length;
  await bp.goto(`${WEB}/host#import=${v}`);
  await bp.waitForTimeout(700);
  const body = await bp.locator("body").innerText();
  const ok = (await bp.locator(".host").count()) === 1 && (await bp.locator(".toast").count()) === 0 && !bp.url().includes("import") && (body.includes("まだイベントがありません") || (await bp.locator(".evcard").count()) >= 0);
  out(`不正な payload（${k}）でも落ちない`, ok && errors.length === errs0, `url=${bp.url().slice(0, 40)} body=${body.replace(/\n/g, " ").slice(0, 50)} errs=${errors.slice(errs0).join("|")}`);
  await bp.close();
}
// 一部不正: 有効2件+不正混在
{
  const bp = await mk(false);
  await bp.goto(`${WEB}/host#import=${payloadOf([{ id: evs[0].id, t: evs[0].hostToken, name: "A", createdAt: dates[0] }, null, { id: "x" }, { id: evs[1].id, t: evs[1].hostToken, name: "B", createdAt: "not-a-date" }])}`);
  await bp.waitForSelector(".evcard"); await bp.waitForTimeout(500);
  out("一部不正でも有効な分だけ取り込む（トーストは2件）", (await bp.locator(".evcard").count()) === 2 && (await bp.locator(".toast").innerText()).includes("2件"), `${await bp.locator(".evcard").count()} ${await bp.locator(".toast").innerText().catch(() => "")}`);
  out("不正な日付でも一覧が壊れない", (await bp.locator(".evcard").count()) === 2 && (await noH(bp)));
  await bp.close();
}
// 同じリンクを再度開いても重複しない
await imp.goto(`${WEB}/host#import=${payload}`); await imp.waitForSelector(".evcard"); await imp.waitForTimeout(500);
out("同じリンクを再度開いても重複しない", (await imp.locator(".evcard").count()) === 3, `${await imp.locator(".evcard").count()}`);

out("コンソールエラーなし", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
console.log(ng ? `${ng} 件 NG` : "ALL OK");
process.exit(ng ? 1 : 0);
