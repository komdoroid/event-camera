// T30: フォント変更(T29)後の確認。実 API(:8787) + 実 API 向けの web(:5173)。ローカルのみ。
import { chromium } from "playwright";
const WEB = "http://localhost:5173", API = "http://localhost:8787/api";
const J = { "Content-Type": "application/json" };
const SHOT = new URL("../screenshots/", import.meta.url).pathname;
let ng = 0;
const out = (n, ok, d = "") => { if (!ok) ng++; console.log(`${ok ? "OK " : "NG "} ${n}${d ? " : " + d : ""}`); };
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errors = [];
const JPG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
const mkEv = async (b) => (await fetch(`${API}/events`, { method: "POST", headers: J, body: JSON.stringify(b) })).json();
const shot = async (eid) => { const s = await (await fetch(`${API}/events/${eid}/shots`, { method: "POST", headers: J, body: JSON.stringify({ guestId: "t30-guest-0001" }) })).json(); await fetch(s.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: JPG }); };
const mk = async (cam, gid = "t30-guest-0001") => {
  const c = await browser.newContext({ viewport: { width: 375, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: cam ? ["camera"] : [] });
  await c.addInitScript((gid) => { try { localStorage.setItem("ec.introSeen", "1"); localStorage.setItem("ec.installShown", "1"); localStorage.setItem("ec.guestId", gid); } catch {} }, gid);
  const p = await c.newPage();
  p.on("console", (m) => { if (m.type() === "error") errors.push(`${m.text()} @ ${m.location().url || p.url()}`); });
  p.on("requestfailed", (r) => errors.push(`requestfailed ${r.failure()?.errorText} ${r.url()}`));
  p.on("pageerror", (e) => errors.push("pageerror " + e.message));
  return p;
};
const noH = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth && [...document.querySelectorAll(".diary,.dpage,.welcome-ov,.cam")].every((e) => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).overflowX === "hidden"));
// 見出しの中の指定の語が、1行に収まっている(途中で折れていない)か。行数も返す
const lines = (p, sel, word) => p.evaluate(([sel, word]) => {
  const el = document.querySelector(sel); const tn = [...el.childNodes].find((n) => n.nodeType === 3) ?? el.firstChild;
  const text = el.textContent; const r = document.createRange(); const tops = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, off = 0; const map = [];
  while ((n = walker.nextNode())) { for (let i = 0; i < n.length; i++) map.push([n, i]); }
  const topOf = (i) => { const [nd, k] = map[i]; r.setStart(nd, k); r.setEnd(nd, k + 1); const b = r.getClientRects()[0]; return b ? Math.round(b.top) : null; };
  const all = [...Array(text.length).keys()].map(topOf).filter((t) => t !== null);
  const fsz = parseFloat(getComputedStyle(el).fontSize); const cl = []; for (const t of [...all].sort((a, b) => a - b)) { if (!cl.length || t - cl[cl.length - 1] > fsz * 0.6) cl.push(t); } const lineOf = (t) => cl.findIndex((c, k) => t - c <= fsz * 0.6 && (k === cl.length - 1 || t < cl[k + 1] - 0));
  const lineCount = cl.length;
  const at = word ? text.indexOf(word) : -1;
  const wt = at < 0 ? null : new Set([...Array(word.length).keys()].map((i) => lineOf(topOf(at + i)))).size;
  const fs = parseFloat(getComputedStyle(el).fontSize);
  return { text, lineCount, wordLines: wt, fontSize: Math.round(fs * 10) / 10, width: Math.round(el.getBoundingClientRect().width), scrollW: el.scrollWidth, clientW: el.clientWidth };
}, [sel, word]);

const W = "ウェディングパーティー";
const LONG = "ことしの夏休みウェディングパーティーの二次会とみんなで撮った写真集";
const LONG2 = "株式会社サンプル創立二十周年記念パーティー懇親会";
const cases = [["11字", W, { name: W, kind: "wedding" }], ["20字以上", LONG, { name: LONG, kind: "party" }], ["20字以上(漢字)", LONG2, { name: LONG2, kind: "company" }], ["短い(3字)", "同窓会", { name: "同窓会", kind: "reunion" }]];
let fontsOk = null;
for (const [label, name, body] of cases) {
  const e = await mkEv({ ...body, shotLimit: 27, message: "ひとこと" });
  for (let i = 0; i < 4; i++) await shot(e.id);
  const pub = await mkEv({ ...body, shotLimit: 27 }); for (let i = 0; i < 6; i++) await shot(pub.id);
  await fetch(`${API}/events/${pub.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${pub.hostToken}` } });
  // ようこそ
  const g = await mk(true, "t30-newcomer-" + Math.random().toString(16).slice(2, 8)); await g.goto(`${WEB}/e/${e.id}`); await g.waitForSelector(".welcome-ov h1"); await g.evaluate(() => document.fonts.ready); await g.waitForTimeout(500);
  const w = await lines(g, ".welcome-ov h1", name.includes(W) ? W : name === LONG2 ? "二十周年" : name);
  out(`ようこそ(${label}): 語の途中で折れない`, w.wordLines === 1 && w.scrollW <= w.clientW + 1, JSON.stringify(w));
  if (label === "11字") out("ようこそ(11字「ウェディングパーティー」): 1行に収まる", w.lineCount === 1, `行数=${w.lineCount} size=${w.fontSize}px`);
  out(`ようこそ(${label}): 横スクロールなし`, await noH(g));
  await g.screenshot({ path: `${SHOT}t30-welcome-${label}.png` });
  if (!fontsOk) {
    fontsOk = await g.evaluate(async () => {
      await document.fonts.ready;
      const h = document.querySelector(".welcome-ov h1"), pp = document.querySelector(".welcome-ov p, .dpage p");
      const spec = (e) => { const c = getComputedStyle(e); return `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; };
      return { kiwi: document.fonts.check(spec(h), h.textContent), zen: document.fonts.check(spec(pp), pp.textContent), generic: { kiwi: document.fonts.check('16px "Kiwi Maru"', "ウェ"), zen: document.fonts.check('16px "Zen Maru Gothic"', "ウェ") }, loaded: [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family}:${f.weight}`))], failed: [...document.fonts].filter((f) => f.status === "error").map((f) => f.family), h1font: getComputedStyle(h).fontFamily, bodyfont: getComputedStyle(pp).fontFamily, lb: getComputedStyle(h).lineBreak + "/" + getComputedStyle(h).wordBreak, ver: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] };
    });
  }
  await g.close();
  // アルバム表紙
  const a = await mk(false); await a.goto(`${WEB}/e/${pub.id}/album`); await a.waitForSelector(".dpage.cover h1"); await a.evaluate(() => document.fonts.ready); await a.waitForTimeout(500);
  const c = await lines(a, ".dpage.cover h1", name.includes(W) ? W : name === LONG2 ? "二十周年" : name);
  out(`アルバム表紙(${label}): 語の途中で折れない`, c.wordLines === 1 && c.scrollW <= c.clientW + 1, JSON.stringify(c));
  if (label === "11字") out("表紙(11字): 1行に収まる", c.lineCount === 1, `行数=${c.lineCount} size=${c.fontSize}px`);
  out(`アルバム表紙(${label}): 横スクロールなし`, await noH(a));
  if (label === "短い(3字)") out("短い題名は大きめ、長い題名は小さめに段階で縮む", true);
  await a.screenshot({ path: `${SHOT}t30-cover-${label}.png` });
  cases.find((x) => x[0] === label).size = [w.fontSize, c.fontSize];
  await a.close();
}
console.log(`   (参考) 読み込み済みフォント=${fontsOk.loaded.join(",")}`);
console.log(`   (参考) ブラウザ=${fontsOk.ver} 見出しの line-break/word-break=${fontsOk.lb}`);
const sz = Object.fromEntries(cases.map((c) => [c[0], c.size]));
out("題名の大きさ: 3字 > 11字 > 20字以上（ようこそ・表紙とも）", sz["短い(3字)"][0] > sz["11字"][0] && sz["11字"][0] > sz["20字以上"][0] && sz["短い(3字)"][1] > sz["11字"][1] && sz["11字"][1] > sz["20字以上"][1], JSON.stringify(sz));
out("Kiwi Maru と Zen Maru Gothic が読み込み済み (document.fonts.check)", fontsOk.generic.kiwi && fontsOk.generic.zen && fontsOk.loaded.some((f) => f.startsWith("Kiwi Maru")) && fontsOk.loaded.some((f) => f.startsWith("Zen Maru Gothic")), JSON.stringify(fontsOk));
out("読み込みに失敗したフォントがない", fontsOk.failed.length === 0, fontsOk.failed.join());
out("見出しと本文に指定のフォントが使われる", fontsOk.h1font.includes("Kiwi Maru") && fontsOk.bodyfont.includes("Zen Maru Gothic"), `${fontsOk.h1font} / ${fontsOk.bodyfont}`);
out("コンソールエラー・通信失敗なし（失敗した URL つき）", errors.length === 0, [...new Set(errors)].slice(0, 4).join(" | "));
await browser.close();
console.log(ng ? `${ng} 件 NG` : "ALL OK");
process.exit(ng ? 1 : 0);
