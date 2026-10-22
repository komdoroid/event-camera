export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  UPLOAD_SIGNING_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_TTL_SEC = 600;
const DEFAULT_SHOT_LIMIT = 27;
const PRODUCTS: Record<string, number> = { digital: 500, print: 3000 };
const MAX_SHOT_LIMIT = 200;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const enc = new TextEncoder();
const nowIso = () => new Date().toISOString();

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = ["http://localhost:5173", ...(env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)];
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && allowed.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET,POST,PUT,OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type,Authorization";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "invalid JSON body");
}

interface EventRow {
  id: string;
  name: string;
  shot_limit: number;
  host_token: string;
  status: string;
  published_at: string | null;
}

async function getEvent(env: Env, id: string): Promise<EventRow> {
  const e = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();
  if (!e) throw new HttpError(404, "event not found");
  return e;
}

function isHost(req: Request, ev: EventRow): boolean {
  const m = /^Bearer (.+)$/.exec(req.headers.get("Authorization") ?? "");
  return !!m && safeEqual(m[1], ev.host_token);
}

function requireHost(req: Request, ev: EventRow) {
  if (!isHost(req, ev)) throw new HttpError(401, "host token required");
}

function validGuestId(v: unknown): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) throw new HttpError(400, "guestId must be 8-64 chars [A-Za-z0-9_-]");
  return v;
}

function photoUrl(origin: string, id: string) {
  return `${origin}/api/photos/${id}`;
}

// 確保済み枠の数（アップロード未完了も含む）
async function countTaken(env: Env, eventId: string, guestId: string): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM photos WHERE event_id = ? AND guest_id = ?").bind(eventId, guestId).first<{ c: number }>();
  return r?.c ?? 0;
}

// 撮影時刻順の写真をページに割り当てる。先頭は cover(1枚)。以降 duo(2) / grid(4) / full(1) / grid(3) を巡回。
// 端数は枚数に応じて full / duo / grid になる（grid は 3〜4 枚）。
function buildPages<T>(photos: T[]): { layout: string; photos: T[] }[] {
  const pages: { layout: string; photos: T[] }[] = [];
  if (photos.length === 0) return pages;
  pages.push({ layout: "cover", photos: [photos[0]] });
  const sizes = [2, 4, 1, 3];
  let i = 1;
  let c = 0;
  while (i < photos.length) {
    let n = Math.min(sizes[c++ % sizes.length], photos.length - i);
    if (photos.length - i - n === 1 && n > 2) n -= 1; // 最後に1枚だけ残さない
    const slice = photos.slice(i, i + n);
    i += n;
    pages.push({ layout: n === 1 ? "full" : n === 2 ? "duo" : "grid", photos: slice });
  }
  return pages;
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;
  const parts = url.pathname.split("/").filter(Boolean);
  const m = req.method;
  if (parts[0] !== "api") throw new HttpError(404, "not found");
  const p = parts.slice(1);

  // POST /api/events
  if (p[0] === "events" && p.length === 1 && m === "POST") {
    const b = await readJson(req);
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name || name.length > 100) throw new HttpError(400, "name is required (max 100 chars)");
    let shotLimit = DEFAULT_SHOT_LIMIT;
    if (b.shotLimit !== undefined) {
      if (!Number.isInteger(b.shotLimit) || (b.shotLimit as number) < 1 || (b.shotLimit as number) > MAX_SHOT_LIMIT)
        throw new HttpError(400, `shotLimit must be an integer 1-${MAX_SHOT_LIMIT}`);
      shotLimit = b.shotLimit as number;
    }
    const id = crypto.randomUUID().slice(0, 8);
    const hostToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    await env.DB.prepare("INSERT INTO events (id, name, shot_limit, host_token, status, created_at) VALUES (?,?,?,?, 'shooting', ?)")
      .bind(id, name, shotLimit, hostToken, nowIso()).run();
    return json({ id, hostToken, name, shotLimit }, 201);
  }

  if (p[0] === "events" && p[1]) {
    const eventId = p[1];

    // GET /api/events/:id
    if (p.length === 2 && m === "GET") {
      const ev = await getEvent(env, eventId);
      const s = await env.DB.prepare("SELECT COUNT(DISTINCT guest_id) AS g, COUNT(*) AS c, COALESCE(SUM(uploaded),0) AS u FROM photos WHERE event_id = ?").bind(eventId).first<{ g: number; c: number; u: number }>();
      return json({ id: ev.id, name: ev.name, shotLimit: ev.shot_limit, status: ev.status, publishedAt: ev.published_at, stats: { guests: s?.g ?? 0, photos: s?.c ?? 0, uploaded: s?.u ?? 0 } });
    }

    // GET /api/events/:id/guests/:guestId
    if (p[2] === "guests" && p[3] && p.length === 4 && m === "GET") {
      const ev = await getEvent(env, eventId);
      const taken = await countTaken(env, eventId, validGuestId(p[3]));
      return json({ taken, remaining: Math.max(0, ev.shot_limit - taken) });
    }

    // POST /api/events/:id/shots
    if (p[2] === "shots" && p.length === 3 && m === "POST") {
      const ev = await getEvent(env, eventId);
      const guestId = validGuestId((await readJson(req)).guestId);
      if (ev.status === "published") throw new HttpError(403, "event already published");
      const taken = await countTaken(env, eventId, guestId);
      if (taken >= ev.shot_limit) throw new HttpError(409, "shot limit reached");
      const photoId = crypto.randomUUID();
      const t = nowIso();
      // 条件付き INSERT で同時リクエストによる上限超過を防ぐ
      const res = await env.DB.prepare(
        "INSERT INTO photos (id, event_id, guest_id, r2_key, uploaded, taken_at) SELECT ?,?,?,?,0,? WHERE (SELECT COUNT(*) FROM photos WHERE event_id = ? AND guest_id = ?) < ?"
      ).bind(photoId, eventId, guestId, `events/${eventId}/${photoId}`, t, eventId, guestId, ev.shot_limit).run();
      if (!res.meta.changes) throw new HttpError(409, "shot limit reached");
      const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SEC;
      const sig = await hmacHex(env.UPLOAD_SIGNING_SECRET, `${photoId}.${exp}`);
      return json({ photoId, uploadUrl: `${origin}/api/uploads/${photoId}?exp=${exp}&sig=${sig}`, expiresAt: new Date(exp * 1000).toISOString(), remaining: ev.shot_limit - taken - 1 }, 201);
    }

    // POST /api/events/:id/publish
    if (p[2] === "publish" && p.length === 3 && m === "POST") {
      const ev = await getEvent(env, eventId);
      requireHost(req, ev);
      if (ev.status === "published") return json({ status: "published", publishedAt: ev.published_at });
      const t = nowIso();
      await env.DB.prepare("UPDATE events SET status='published', published_at=? WHERE id=?").bind(t, eventId).run();
      return json({ status: "published", publishedAt: t });
    }

    // GET /api/events/:id/album
    if (p[2] === "album" && p.length === 3 && m === "GET") {
      const ev = await getEvent(env, eventId);
      if (ev.status !== "published") throw new HttpError(403, "album is not available before publishing");
      const rows = await env.DB.prepare("SELECT id, taken_at FROM photos WHERE event_id = ? AND uploaded = 1 ORDER BY taken_at, id").bind(eventId).all<{ id: string; taken_at: string }>();
      const list = rows.results.map((r) => ({ id: r.id, url: photoUrl(origin, r.id), takenAt: r.taken_at }));
      const g = await env.DB.prepare("SELECT COUNT(DISTINCT guest_id) AS g FROM photos WHERE event_id = ? AND uploaded = 1").bind(eventId).first<{ g: number }>();
      return json({
        event: { id: ev.id, name: ev.name, shotLimit: ev.shot_limit, status: ev.status, publishedAt: ev.published_at },
        stats: { guests: g?.g ?? 0, photos: list.length },
        pages: buildPages(list),
      });
    }

    // GET /api/events/:id/photos
    if (p[2] === "photos" && p.length === 3 && m === "GET") {
      const ev = await getEvent(env, eventId);
      requireHost(req, ev);
      const rows = await env.DB.prepare("SELECT id, taken_at, guest_id FROM photos WHERE event_id = ? AND uploaded = 1 ORDER BY taken_at, id").bind(eventId).all<{ id: string; taken_at: string; guest_id: string }>();
      return json({ photos: rows.results.map((r) => ({ id: r.id, url: photoUrl(origin, r.id), takenAt: r.taken_at, guestId: r.guest_id })) });
    }

    // POST /api/events/:id/orders
    if (p[2] === "orders" && p.length === 3 && m === "POST") {
      const ev = await getEvent(env, eventId);
      const b = await readJson(req);
      const guestId = validGuestId(b.guestId);
      const product = b.product;
      if (typeof product !== "string" || !Object.hasOwn(PRODUCTS, product)) throw new HttpError(400, "product must be digital or print");
      if (ev.status !== "published") throw new HttpError(403, "event is not published yet");
      const orderId = crypto.randomUUID();
      const amount = PRODUCTS[product];
      await env.DB.prepare("INSERT INTO orders (id, event_id, guest_id, product, amount, status, created_at) VALUES (?,?,?,?,?, 'paid_mock', ?)")
        .bind(orderId, eventId, guestId, product, amount, nowIso()).run();
      return json({ orderId, product, amount, status: "paid_mock" }, 201);
    }
  }

  // PUT /api/uploads/:photoId
  if (p[0] === "uploads" && p[1] && p.length === 2 && m === "PUT") {
    const photoId = p[1];
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig") ?? "";
    if (!Number.isFinite(exp)) throw new HttpError(403, "invalid signature");
    const expected = await hmacHex(env.UPLOAD_SIGNING_SECRET, `${photoId}.${exp}`);
    if (!safeEqual(expected, sig)) throw new HttpError(403, "invalid signature");
    if (Date.now() / 1000 > exp) throw new HttpError(410, "upload url expired");
    const ct = (req.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.includes(ct)) throw new HttpError(415, "Content-Type must be image/jpeg, image/png or image/webp");
    const len = Number(req.headers.get("Content-Length"));
    if (!Number.isFinite(len) || len <= 0) throw new HttpError(411, "Content-Length required");
    if (len > MAX_UPLOAD_BYTES) throw new HttpError(413, "image too large (max 10MB)");
    const photo = await env.DB.prepare("SELECT r2_key, uploaded FROM photos WHERE id = ?").bind(photoId).first<{ r2_key: string; uploaded: number }>();
    if (!photo) throw new HttpError(404, "photo not found");
    if (photo.uploaded) throw new HttpError(409, "photo already uploaded");
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, "image too large (max 10MB)");
    await env.PHOTOS.put(photo.r2_key, body, { httpMetadata: { contentType: ct } });
    await env.DB.prepare("UPDATE photos SET uploaded = 1 WHERE id = ?").bind(photoId).run();
    return new Response(null, { status: 204 });
  }

  // GET /api/photos/:photoId
  if (p[0] === "photos" && p[1] && p.length === 2 && m === "GET") {
    const photo = await env.DB.prepare("SELECT r2_key, event_id FROM photos WHERE id = ? AND uploaded = 1").bind(p[1]).first<{ r2_key: string; event_id: string }>();
    if (!photo) throw new HttpError(404, "photo not found");
    const ev = await getEvent(env, photo.event_id);
    // <img> はヘッダを付けられないので、ホストは ?token= でも可
    const qt = url.searchParams.get("token");
    const host = isHost(req, ev) || (!!qt && safeEqual(qt, ev.host_token));
    if (ev.status !== "published" && !host) throw new HttpError(403, "photo is not available before publishing");
    const obj = await env.PHOTOS.get(photo.r2_key);
    if (!obj) throw new HttpError(404, "photo data not found");
    return new Response(obj.body, {
      headers: {
        "Content-Type": ALLOWED_TYPES.includes(obj.httpMetadata?.contentType ?? "") ? obj.httpMetadata!.contentType! : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        "Cache-Control": ev.status === "published" ? "public, max-age=3600" : "private, no-store",
      },
    });
  }

  throw new HttpError(404, "not found");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let res: Response;
    try {
      res = await route(req, env);
    } catch (e) {
      if (e instanceof HttpError) res = json({ error: e.message }, e.status);
      else {
        console.error("unhandled error", e instanceof Error ? e.message : "unknown");
        res = json({ error: "internal error" }, 500);
      }
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
} satisfies ExportedHandler<Env>;
