// T26: カラフルなパレット(T24)と巻き上げダイヤル(T25)。実 API(:8787) + 実 API 向けの web(:5173)。ローカルのみ。
import { chromium } from "playwright";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const J = { "Content-Type": "application/json" };
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
let ng = 0;
const out = (n, ok, d = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${n}${d ? " : " + d : ""}`); };
const sec = async (name, fn) => { console.log(`--- ${name}`); try { await fn(); } catch (e) { ng++; console.log(`NG  [${name}] 途中で失敗: ${String(e.message).split("\n")[0]}`); } };
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
async function mk(o = {}) {
  const c = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: o.cam ? ["camera"] : [] });
  await c.addInitScript((o) => { try { localStorage.setItem("ec.introSeen", "1"); localStorage.setItem("ec.installShown", "1"); if (o.guestId) localStorage.setItem("ec.guestId", o.guestId); } catch {} }, o);
  const p = await c.newPage();
  // 失敗した URL も記録（原因不明の ERR_CONNECTION_REFUSED を見つけるため）
  p.on("console", (m) => { if (m.type() === "error") errors.push(`${m.text()} @ ${m.location().url || p.url()}`); });
  p.on("requestfailed", (r) => errors.push(`requestfailed ${r.failure()?.errorText} ${r.url()}`));
  p.on("pageerror", (e) => errors.push("pageerror " + e.message));
  return p;
}
const noH = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll(".host,.cam,.dialog,.welcome-ov,.hprint")].every((e) => e.scrollWidth <= e.clientWidth + 1));
const snap = async (p, n, h = true) => { await p.waitForTimeout(450); await p.screenshot({ path: `${SHOT}t26-${n}.png` }); if (h) out(`[${n}] 横スクロールなし`, await noH(p)); };
const mkEv = async (b) => (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify(b) })).json();
const JPG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
const shot = async (eid, g) => { const s = await (await fetch(`${API}/events/${eid}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId: g }) })).json(); const r = await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPG }); if (r.status !== 204) throw new Error("PUT " + r.status); };
const publish = (e) => fetch(`${API}/events/${e.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${e.hostToken}` } });
const loaded = (p) => p.waitForFunction(() => { const h = document.querySelector("h1.evtitle"); return h && !h.textContent.includes("読み込み中"); });
const HEX = { blue: "#a6d4e4", pink: "#f6c0ba", yellow: "#ffd96a", mint: "#9fe0c4", orange: "#ffb27a", purple: "#c7b3f0" };
const KIND_COLOR = { birthday: "yellow", party: "orange", reunion: "mint", trip: "blue", company: "purple", wedding: "pink", other: "blue" };
const PAGE_COLORS = ["yellow", "mint", "pink", "blue", "orange", "purple"];
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const parse = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const wind = async (p, from = 20, to = 300) => {
  const b = await p.locator(".wheel").boundingBox(); const y = b.y + b.height / 2;
  await p.mouse.move(b.x + from, y); await p.mouse.down();
  for (let x = from; x <= to; x += 20) await p.mouse.move(b.x + x, y);
  await p.mouse.up();
};

// ================= ダイヤル（実 API の流れ） =================
await sec("D ダイヤル（実 API・フェイクカメラ）", async () => {
  const e = await mkEv({ name: "ダイヤル", shotLimit: 6, kind: "other" });
  const p = await mk({ cam: true });
  await p.goto(`${WEB}/e/${e.id}`); await p.waitForSelector(".welcome-ov");
  await p.click(".welcome-ov >> text=カメラをはじめる");
  await p.waitForSelector(".welcome-ov", { state: "detached" }); await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("撮影できます"));
  const phase = () => p.evaluate(() => document.querySelector(".dsvg").dataset.phase);
  const wound = () => p.evaluate(() => document.querySelector(".cam").dataset.wound);
  const stat = () => p.locator(".cam-bot .lbl.stat").innerText();
  const left = async () => (await p.locator(".roll").first().innerText()).trim().slice(-2);
  out("巻き上げ済みの初期状態は READY", (await p.locator(".wlabel").innerText()).includes("READY") && (await wound()) === "1");
  await p.click("button.shutter");
  await p.waitForFunction(() => document.querySelector(".cam-bot .lbl.stat")?.textContent?.includes("巻き上げ待ち"));
  out("シャッター後は「巻き上げ待ち」", (await stat()).includes("巻き上げ待ち"));
  out("シャッター後のラベルは READY ではない", !(await p.locator(".wlabel").innerText()).includes("READY"));
  await p.waitForTimeout(500); const l1 = await left();
  await p.click("button.shutter"); await p.waitForTimeout(300);
  out("巻き上げ前のシャッターは無効（残り枚数が変わらない）", (await left()) === l1, `${l1} -> ${await left()}`);
  // スワイプ中の位相
  const b = await p.locator(".wheel").boundingBox(); const y = b.y + b.height / 2;
  await p.mouse.move(b.x + 20, y); await p.mouse.down();
  const seen = [await phase()];
  for (let x = 20; x <= 100; x += 20) { await p.mouse.move(b.x + x, y); seen.push(await phase()); }
  out("スワイプで data-phase が変わる", new Set(seen).size >= 4, JSON.stringify(seen));
  await snap(p, "dial-during");
  for (let x = 120; x <= 300; x += 17) await p.mouse.move(b.x + x, y);
  const atWound = await phase();
  await p.mouse.move(b.x + 340, y); await p.mouse.move(b.x + 360, y);
  out("巻き切ったあとは回らない", (await phase()) === atWound, `${atWound} -> ${await phase()}`);
  await p.mouse.up(); await p.waitForTimeout(300);
  out("巻き切ると READY・「撮影できます」", (await wound()) === "1" && (await stat()).includes("撮影できます") && (await p.locator(".wlabel").innerText()).includes("READY"));
  await snap(p, "dial-ready");
  await p.click("button.shutter"); await p.waitForTimeout(700);
  out("巻き切ったあとシャッターが切れる（残り -1）", Number(await left()) === Number(l1) - 1, `${l1} -> ${await left()}`);
  out("シャッター後は再び巻き上げが必要", (await wound()) === "0");
  // 途中でやめると巻けない
  await p.mouse.move(b.x + 20, y); await p.mouse.down(); for (let x = 20; x <= 80; x += 20) await p.mouse.move(b.x + x, y); await p.mouse.up();
  out("途中でやめたら巻き上がらない", (await wound()) === "0");
  await p.click("button.shutter"); await p.waitForTimeout(300);
  out("巻き上がっていないとシャッターは無効", Number(await left()) === Number(l1) - 1);
  await wind(p);
  out("もう一度巻くと撮影できる", (await wound()) === "1");
  await p.click("button.shutter"); await p.waitForTimeout(600);
  out("2枚目の撮影", Number(await left()) === Number(l1) - 2, await left());
  // 左向きでも巻ける
  await wind(p, 300, 20).catch(() => {});
  const b2 = await p.locator(".wheel").boundingBox();
  await p.mouse.move(b2.x + 300, y); await p.mouse.down(); for (let x = 300; x >= 60; x -= 20) await p.mouse.move(b2.x + x, y); await p.mouse.up();
  out("左向きのスワイプでも巻ける", (await wound()) === "1");
  // 重なり
  const sh = await p.locator("button.shutter").boundingBox(), dl = await p.locator(".dial").boundingBox(), wh = await p.locator(".wheel").boundingBox();
  out("ダイヤルとシャッターが重ならない（375px）", !(dl.x < sh.x + sh.width && dl.x + dl.width > sh.x && dl.y < sh.y + sh.height && dl.y + dl.height > sh.y), JSON.stringify({ dl, sh }));
  out("ダイヤルの見える部分が画面内（右30pxは画面の端で切れる意図した見え方。横スクロールにはならない）", wh.x >= 0 && wh.x + wh.width <= 375 + 1 && dl.x + dl.width - (wh.x + wh.width) <= 40, JSON.stringify({ wh, dl }));
  out("カメラ画面 横スクロールなし", await noH(p));
  await snap(p, "camera-dial");
  // キーボード（巻き上げのスライダー）
  out("ダイヤルは role=slider で操作できる", (await p.locator(".wheel[role=slider]").count()) === 1);
  await p.close();
});

// ================= 種類ごとのテーマ色 =================
const evs = {};
await sec("C0 準備: 7種類のイベント（撮影中・現像済み）", async () => {
  for (const k of Object.keys(KIND_COLOR)) {
    const sh = await mkEv({ name: `色-${k}`, shotLimit: 27, kind: k, message: "色のテスト" }); await shot(sh.id, "t26-guest-0001"); await shot(sh.id, "t26-guest-0002");
    const pub = await mkEv({ name: `色公開-${k}`, shotLimit: 27, kind: k, message: "色のテスト" });
    for (let i = 0; i < 10; i++) await shot(pub.id, `t26-guest-000${i % 4}`); await publish(pub);
    evs[k] = { shooting: sh, published: pub };
  }
  out("準備完了", Object.keys(evs).length === 7);
});

const themeOf = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).getPropertyValue("--theme").trim() : null; }, sel);
const bgOf = (p, sel, pseudo) => p.evaluate(([sel, ps]) => { const e = document.querySelector(sel); return e ? getComputedStyle(e, ps || null).backgroundColor : null; }, [sel, pseudo]);
const colorOf = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).color : null; }, sel);
const contrasts = [];

await sec("C1 管理画面・ようこそ・アルバム表紙のテーマ色（7種類）", async () => {
  for (const [k, c] of Object.entries(KIND_COLOR)) {
    const want = HEX[c];
    // 管理画面（撮影中）
    const h = await mk(); await h.goto(`${WEB}/host`); await h.evaluate(([id, t]) => localStorage.setItem(`ec.hostToken.${id}`, t), [evs[k].shooting.id, evs[k].shooting.hostToken]);
    await h.goto(`${WEB}/host/${evs[k].shooting.id}`); await h.waitForSelector(".stage"); await loaded(h);
    const t = await themeOf(h, '[style*="--theme"]');
    const btn = await bgOf(h, ".stage .hbtn.ghost");
    out(`管理画面(${k}): テーマ色 ${c} ${want}`, t?.toLowerCase() === want && btn === rgb(want), `--theme=${t} 主ボタン背景=${btn}`);
    contrasts.push([`管理画面 主ボタン(${k})`, ratio(parse(await colorOf(h, ".stage .hbtn.ghost")), parse(btn))]);
    contrasts.push([`管理画面 チップ(${k})`, ratio(parse(await colorOf(h, ".stage .chip")), parse(await bgOf(h, ".stage .chip")))]);
    if (["birthday", "party", "reunion", "company", "wedding", "trip"].includes(k)) await snap(h, `host-${k}`); else out(`[host-${k}] 横スクロールなし`, await noH(h));
    await h.close();
    // ようこそ
    const g = await mk({ cam: true }); await g.goto(`${WEB}/e/${evs[k].shooting.id}`); await g.waitForSelector(".welcome-ov");
    const wt = await themeOf(g, '.welcome-ov [style*="--theme"], .welcome-ov, .cam[style*="--theme"]');
    const wbtn = await bgOf(g, ".welcome-ov .hbtn2", "::before");
    out(`ようこそ(${k}): テーマ色 ${c}`, wbtn === rgb(want), `--theme=${wt} ボタン背景=${wbtn}`);
    contrasts.push([`ようこそ ボタン(${k})`, ratio(parse(await colorOf(g, ".welcome-ov .hbtn2")), parse(wbtn))]);
    if (["birthday", "party", "reunion", "company", "wedding", "trip"].includes(k)) await snap(g, `welcome-${k}`); else out(`[welcome-${k}] 横スクロールなし`, await noH(g));
    await g.close();
    // アルバム表紙
    const a = await mk({ guestId: "t26-guest-0001" }); await a.goto(`${WEB}/e/${evs[k].published.id}/album`); await a.waitForSelector(".dpage.cover");
    const pc = await a.evaluate(() => getComputedStyle(document.querySelector(".dpage.cover")).getPropertyValue("--pc").trim());
    out(`アルバム表紙(${k}): テーマ色 ${c}`, pc.toLowerCase() === want, `--pc=${pc}`);
    contrasts.push([`表紙 題名(${k})`, ratio(parse(await colorOf(a, ".dpage.cover h1")), parse(await a.evaluate(() => { let e = document.querySelector(".dpage.cover"); while (e) { const b = getComputedStyle(e).backgroundColor; if (b !== "rgba(0, 0, 0, 0)") return b; e = e.parentElement; } return "rgb(255,255,255)"; })))]);
    if (["birthday", "party", "reunion", "company", "wedding", "trip"].includes(k)) await snap(a, `cover-${k}`); else out(`[cover-${k}] 横スクロールなし`, await noH(a));
    await a.close();
  }
});

await sec("C2 アルバムのページ色が順に回る・最後のページ・主ボタン", async () => {
  const E = evs.reunion.published;
  const p = await mk({ guestId: "t26-guest-0001" });
  await p.goto(`${WEB}/e/${E.id}/album`); await p.waitForSelector(".dpage.cover");
  const total = Number((await p.locator(".pn").innerText()).split("/")[1]);
  const cols = [], priCounts = [];
  const pri = () => p.locator(".diary .hbtn2.pri:visible:not([disabled])").count();
  for (let i = 0; i < total; i++) {
    if (i > 0 && i < total - 1) cols.push([i, (await p.evaluate(() => getComputedStyle(document.querySelector(".dpage")).getPropertyValue("--pc").trim())).toLowerCase()]);
    priCounts.push(await pri());
    if (i === 1) { contrasts.push(["アルバムのページ ひとこと", ratio(parse(await colorOf(p, ".dpage .dlines .note")), parse(await p.evaluate(() => { let e = document.querySelector(".dpage"); while (e) { const b = getComputedStyle(e).backgroundColor; if (b !== "rgba(0, 0, 0, 0)") return b; e = e.parentElement; } return "rgb(255,255,255)"; })))]); await snap(p, "album-page"); }
    if (i < total - 1) { await p.click(".pager button:has-text('つぎ')"); await p.waitForTimeout(60); }
  }
  const expect = cols.map(([i]) => HEX[PAGE_COLORS[i % 6]]);
  out("ページの色が 黄→みどり→ピンク→青→オレンジ→むらさき の順に回る", cols.every(([, c], j) => c === expect[j]), cols.map(([i, c]) => `${i}:${c}`).join(" "));
  out("隣り合うページは違う色", cols.every(([, c], j) => j === 0 || c !== cols[j - 1][1]));
  out("ページ色は3色以上使われる", new Set(cols.map(([, c]) => c)).size >= 3, [...new Set(cols.map(([, c]) => c))].join());
  out("アルバム各ページの主ボタンはちょうど1つ（表紙〜中身は「つぎ」）", priCounts.slice(0, -1).every((n) => n === 1), JSON.stringify(priCounts));
  out("最後のページの主ボタンはちょうど1つ（えらぶ。無効な「つぎ」は数えない）", priCounts.at(-1) === 1 && (await p.locator(".dpage.end .hbtn2.pri").count()) === 1, JSON.stringify(priCounts));
  await snap(p, "album-end");
  await p.click(".dpage.end >> text=えらぶ"); await p.waitForSelector(".buy");
  const cardPri = await p.locator(".buy .hcard").evaluateAll((cs) => cs.map((c) => !!c.querySelector("button.pri")));
  out("購入シート: 主ボタンはデジタルだけ（印刷は主ではない）", cardPri.join() === "true,false", cardPri.join());
  out("購入シート: 主ボタンの数は1つ", (await p.locator(".buy .hbtn2.pri").count()) === 1);
  contrasts.push(["購入シート 主ボタン", ratio(parse(await colorOf(p, ".buy .hbtn2.pri")), parse(await bgOf(p, ".buy .hbtn2.pri", "::before")))]);
  await snap(p, "buy");
  await p.locator(".buy .hcard button.pri").click(); await p.waitForSelector(".donep");
  out("完了(デジタル): 主ボタンは1つ（友だちに知らせる）", (await p.locator(".donep .hbtn2.pri").count()) === 1);
  await snap(p, "done-digital");
  await p.close();
  // 印刷の完了
  const q = await mk({ guestId: "t26-print-guest" }); await q.goto(`${WEB}/e/${E.id}/album`); await q.waitForSelector(".dpage.cover");
  for (let i = 0; i < 40 && !(await q.locator(".dpage.end").count()); i++) await q.click(".pager button:has-text('つぎ')");
  await q.click(".dpage.end >> text=えらぶ"); await q.waitForSelector(".buy"); await q.locator(".buy .hcard button").nth(1).click(); await q.waitForSelector(".donep");
  out("完了(印刷): 主ボタンは送信の1つ", (await q.locator(".donep .hbtn2.pri").count()) === 1);
  await snap(q, "done-print");
  await q.close();
});

await sec("C3 主ボタンは各画面で1つ（ホスト側・ようこそ・お知らせ）", async () => {
  const hp = (p) => p.locator(".host-in .hbtn.ghost:visible:not([disabled]), .hprint .hbtn.ghost:visible:not([disabled])").count();
  const p = await mk();
  await p.goto(`${WEB}/host`); await p.waitForSelector(".empty");
  out("マイイベント(空): 主ボタンは「最初のイベントをつくる」の1つ", (await hp(p)) === 1);
  await snap(p, "host-empty");
  await p.goto(`${WEB}/host/new`); await p.waitForSelector(".kindgrid");
  out("イベントをつくる: 主ボタンは「作成する」の1つ", (await hp(p)) === 1);
  // 種類タイルの色（選択中のタイルが種類の色）
  for (const k of ["birthday", "party", "reunion", "trip", "company", "wedding", "other"]) {
    const label = { birthday: "誕生日", party: "飲み会・パーティー", reunion: "同窓会", trip: "旅行", company: "社内イベント", wedding: "結婚式", other: "そのほか" }[k];
    await p.click(`.kindtile:has-text('${label}')`);
    const bg = await p.evaluate(() => getComputedStyle(document.querySelector(".kindtile.on")).backgroundColor);
    const btn = await p.evaluate(() => getComputedStyle(document.querySelector("form .hbtn.ghost")).backgroundColor);
    if (!(bg === rgb(HEX[KIND_COLOR[k]]) || btn === rgb(HEX[KIND_COLOR[k]]))) out(`作成フォーム: 種類「${label}」の色が反映される`, false, `tile=${bg} button=${btn} want=${rgb(HEX[KIND_COLOR[k]])}`);
    else if (k === "party") out("作成フォーム: 選んだ種類の色が反映される（例: 飲み会=オレンジ）", true);
  }
  contrasts.push(["作成フォーム 選択タイル", ratio(parse(await colorOf(p, ".kindtile.on")), parse(await bgOf(p, ".kindtile.on")))]);
  await snap(p, "host-new");
  await p.close();
  // 印刷・マイイベント
  const E = evs.party.shooting;
  const h = await mk(); await h.goto(`${WEB}/host`); await h.evaluate(([id, t]) => { localStorage.setItem(`ec.hostToken.${id}`, t); localStorage.setItem("ec.myEvents", JSON.stringify([{ id, name: "色-party", createdAt: new Date().toISOString() }])); }, [E.id, E.hostToken]);
  await h.goto(`${WEB}/host/${E.id}/print`); await h.waitForSelector(".pcard img");
  out("印刷ページ: 主ボタンは「印刷する」の1つ", (await hp(h)) === 1);
  await snap(h, "print");
  await h.goto(`${WEB}/host`); await h.waitForSelector(".evcard .chip");
  out("マイイベント(一覧): 主ボタンは多くても1つ", (await hp(h)) <= 1, `${await hp(h)}`);
  await snap(h, "host-list");
  await h.close();
  // お知らせ・待つ
  const pub = evs.wedding.published;
  const a = await mk({ guestId: "t26-guest-0001" }); await a.goto(`${WEB}/e/${pub.id}`); await a.waitForSelector("text=ひらく");
  out("お知らせ(とどきました): 主ボタンは「ひらく」の1つ", (await a.locator(".dpage.screen .hbtn2.pri:visible").count()) === 1);
  contrasts.push(["お知らせ ボタン", ratio(parse(await colorOf(a, ".dpage.screen .hbtn2.pri")), parse(await bgOf(a, ".dpage.screen .hbtn2.pri", "::before")))]);
  await snap(a, "announce");
  await a.close();
  // ようこそは1つ
  const g = await mk({ cam: true }); await g.goto(`${WEB}/e/${evs.trip.shooting.id}`); await g.waitForSelector(".welcome-ov");
  out("ようこそ: ボタンは「カメラをはじめる」の1つ", (await g.locator(".welcome-ov .hbtn2").count()) === 1);
  await g.close();
  // 管理画面の3段階を種類=誕生日で（黄）
  const ready = await mkEv({ name: "準備", kind: "birthday" });
  const r = await mk(); await r.goto(`${WEB}/host`); await r.evaluate(([id, t]) => localStorage.setItem(`ec.hostToken.${id}`, t), [ready.id, ready.hostToken]);
  await r.goto(`${WEB}/host/${ready.id}`); await r.waitForSelector("img.qr"); await loaded(r);
  out("管理画面(準備中): 主ボタンは1つ", (await hp(r)) === 1);
  await r.close();
  const d = await mk(); await d.goto(`${WEB}/host`); await d.evaluate(([id, t]) => localStorage.setItem(`ec.hostToken.${id}`, t), [evs.birthday.published.id, evs.birthday.published.hostToken]);
  await d.goto(`${WEB}/host/${evs.birthday.published.id}`); await d.waitForSelector(".stage .chip.published, .stage .chip"); await loaded(d);
  out("管理画面(現像済み): 主ボタンは1つ（ゲストに知らせる）", (await hp(d)) === 1 && (await d.locator(".stage .hbtn.ghost").innerText()) === "ゲストに知らせる");
  await snap(d, "host-developed");
  await d.close();
});

await sec("R 文字の読みやすさ（墨色 on 色）", async () => {
  const low = contrasts.filter(([, r]) => r < 4.5);
  console.log(`   計測 ${contrasts.length} 箇所。最小のコントラスト比: ${Math.min(...contrasts.map(([, r]) => r)).toFixed(2)}（${contrasts.sort((a, b) => a[1] - b[1])[0][0]}）`);
  out("すべての計測箇所でコントラスト比 4.5 以上", low.length === 0, low.map(([n, r]) => `${n}=${r.toFixed(2)}`).join(", "));
});

await sec("E コンソールエラー", async () => {
  out("コンソールエラー・通信失敗なし（失敗した URL も表示）", errors.length === 0, [...new Set(errors)].slice(0, 5).join(" | "));
});

await browser.close();
console.log(ng ? `${ng} 件 NG` : "ALL OK");
process.exit(ng ? 1 : 0);
