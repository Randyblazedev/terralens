import { verifyUser, verifyAdmin } from "../../_lib/guard.js";
import { clean, cleanUrl } from "../../_lib/env.js";
import { encryptAes128gcm, b64urlEncode } from "./encrypt.js";
import { rest, vapidHeaders } from "./vapid.js";

// Called right after a notification row is inserted. Sends a real Web Push to
// every device of the recipient, so the alert arrives even with the app closed.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const caller = await verifyUser(req);
  if (!caller) return res.status(401).json({ error: "Sign in first" });

  const rawAuth = String(req.headers.authorization || "");
  const token = rawAuth.replace(/^Bearer\s+/i, "");
  const base = cleanUrl("SUPABASE_URL"), key = clean("SUPABASE_PUBLISHABLE_KEY");
  const pub = clean("VAPID_PUBLIC_KEY"), priv = clean("VAPID_PRIVATE_KEY");
  const subject = clean("VAPID_SUBJECT") || "mailto:admin@terralens.app";
  if (!pub || !priv) return res.status(200).json({ ok: true, sent: 0 });

  const b = req.body || {};
  const targets = Array.from(new Set((Array.isArray(b.userIds) ? b.userIds : b.userId ? [b.userId] : [])
    .map(x => String(x)).filter(x => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(x)))).slice(0, 200);
  if (!targets.length) return res.status(200).json({ ok: true, sent: 0 });
  const title = String(b.title || "TerraLens: new notification").slice(0, 120);
  const body = String(b.body || "").slice(0, 240);
  const link = String(b.link || "/notifications.html").slice(0, 300);

  let sent = 0;
  const payload = JSON.stringify({ title, body, url: link, tag: "terralens-notif" });
  for (const userId of targets) {
    let devices = [];
    try {
      devices = await rest("rpc/push_devices_for?p_user=" + encodeURIComponent(userId), { token }, base, key);
    } catch { continue; }
    for (const s of (devices || [])) {
      try {
        const enc = encryptAes128gcm({ p256dh: s.p256dh, auth: s.auth }, null, payload);
        const headers = await vapidHeaders(s.endpoint, pub, priv, subject, true);
        const r = await fetch(s.endpoint, { method: "POST", headers, body: enc.body });
        if ([200, 201, 204].includes(r.status)) { sent++; continue; }
        if (r.status === 404 || r.status === 410) {
          try { await rest("push_subscriptions?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE", token }, base, key); } catch {}
        }
      } catch {}
    }
  }
  return res.status(200).json({ ok: true, sent });
}
