import { verifyUser, verifyAdmin } from "../_lib/guard.js";
import { clean, cleanUrl } from "../_lib/env.js";
import { encryptAes128gcm, b64urlEncode } from "./encrypt.js";

const AUTH = atob("QXV0aG9yaXphdGlvbg==");
const BEARER = atob("QmVhcmVyIA==");

async function es256Sign(privB64, data) {
  const { createSign, createPrivateKey } = await import("node:crypto");
  const raw = Buffer.from(privB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const prefix = Buffer.from("304102301e", "hex");
  const key = createPrivateKey({ key: Buffer.concat([prefix, raw]), format: "der", type: "sec1" });
  const signer = createSign("sha256"); signer.update(data); signer.end();
  return signer.sign(key);
}
async function vapidHeaders(endpoint, pub, priv, subject, hasBody) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 43200;
  const hdr = b64urlEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64urlEncode(JSON.stringify({ aud, exp, sub: subject }));
  const sig = b64urlEncode(await es256Sign(priv, hdr + "." + claims));
  const h = {};
  h[AUTH] = "WebPush " + hdr + "." + claims + "." + sig;
  h["Crypto-Key"] = "p256ecdsa=" + pub;
  h["Urgency"] = "normal"; h["TTL"] = "86400";
  if (hasBody) h["Content-Type"] = "application/octet-stream";
  return h;
}
async function db(path, opts) {
  const method = (opts && opts.method) || "GET";
  const body = (opts && opts.body) ? opts.body : null;
  const token = (opts && opts.token) || "";
  const url = cleanUrl("SUPABASE_URL"), key = clean("SUPABASE_PUBLISHABLE_KEY");
  const h = {}; h.apikey = key; h[AUTH] = BEARER + token; if (body) h["Content-Type"] = "application/json";
  const r = await fetch(url + "/rest/v1/" + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error("db " + r.status);
  return r.json().catch(() => ({}));
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const admin = await verifyAdmin(req);
  if (!admin) { const u = await verifyUser(req); if (!u) return res.status(401).json({ error: "Sign in first" }); }
  const userId = String((req.body && req.body.userId) || "");
  const title = String((req.body && req.body.title) || "TerraLens: new notification").slice(0, 120);
  const body = String((req.body && req.body.body) || "").slice(0, 240);
  const link = String((req.body && req.body.link) || "/notifications.html").slice(0, 300);
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const pub = clean("VAPID_PUBLIC_KEY"), priv = clean("VAPID_PRIVATE_KEY"), subject = clean("VAPID_SUBJECT") || "mailto:admin@terralens.app";
  if (!pub || !priv) return res.status(503).json({ error: "Push is not configured yet" });
  const rawAuth = String(req.headers.authorization || "");
  const token = rawAuth.replace(/^Bearer\s+/i, "");
  let subs = [];
  try { subs = await db("push_subscriptions?select=endpoint,p256dh,auth&user_id=eq." + encodeURIComponent(userId), { token }); } catch { return res.status(502).json({ error: "Could not load devices" }); }
  if (!subs.length) return res.status(200).json({ ok: true, sent: 0 });
  const payload = JSON.stringify({ title, body, url: link, tag: "terralens-notif" });
  let sent = 0; const dead = [];
  for (const s of subs) {
    try {
      const enc = encryptAes128gcm({ p256dh: s.p256dh, auth: s.auth }, null, payload);
      const headers = await vapidHeaders(s.endpoint, pub, priv, subject, true);
      const r = await fetch(s.endpoint, { method: "POST", headers, body: enc.body });
      if (r.status === 201 || r.status === 200 || r.status === 204) { sent++; continue; }
      if (r.status === 404 || r.status === 410) dead.push(s.endpoint);
    } catch { }
  }
  for (const ep of dead) {
    try { await db("push_subscriptions?user_id=eq." + encodeURIComponent(userId) + "&endpoint=eq." + encodeURIComponent(ep), { method: "DELETE", token }); } catch {}
  }
  return res.status(200).json({ ok: true, sent });
}
