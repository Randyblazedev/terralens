import { verifyUser, verifyAdmin } from "../../_lib/guard.js";
import { clean, cleanUrl } from "../../_lib/env.js";
import { encryptAes128gcm, b64urlEncode } from "./encrypt.js";
import { rest, vapidHeaders, AUTH, BEARER } from "./vapid.js";

const db = (path, opts) => rest(path, opts, cleanUrl("SUPABASE_URL"), clean("SUPABASE_PUBLISHABLE_KEY"));

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
