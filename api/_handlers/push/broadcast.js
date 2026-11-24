import { verifyUser, verifyAdmin } from "../../_lib/guard.js";
import { clean, cleanUrl } from "../../_lib/env.js";
import { encryptAes128gcm } from "./encrypt.js";
import { rest, vapidHeaders } from "./vapid.js";

// Admin-only broadcast: writes a real notification for every profile and delivers a
// real Web Push to each subscribed device. Nothing is simulated.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!await verifyAdmin(req)) return res.status(403).json({ error: "Admins only" });
  const caller = await verifyUser(req);
  if (!caller) return res.status(401).json({ error: "Sign in first" });

  const body = req.body || {};
  const title = String(body.title || "").trim().slice(0, 120);
  const text = String(body.body || "").trim().slice(0, 240);
  const link = String(body.link || "/notifications.html").slice(0, 300);
  if (title.length < 4) return res.status(400).json({ error: "Add a title of at least 4 characters" });

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const base = cleanUrl("SUPABASE_URL"), key = clean("SUPABASE_PUBLISHABLE_KEY");
  const pub = clean("VAPID_PUBLIC_KEY"), priv = clean("VAPID_PRIVATE_KEY");
  const subject = clean("VAPID_SUBJECT") || "mailto:admin@terralens.app";

  let profiles = [];
  try {
    for (let from = 0; ; from += 1000) {
      const chunk = await rest(`profiles?select=id&order=id&limit=1000&offset=${from}`, { token }, base, key);
      profiles = profiles.concat(chunk || []);
      if (!chunk || chunk.length < 1000) break;
    }
  } catch (err) {
    return res.status(502).json({ error: "Could not load users: " + (err.message || "db error") });
  }
  const userIds = profiles.map(p => p.id).filter(Boolean);
  if (!userIds.length) return res.status(200).json({ ok: true, notified: 0, pushed: 0 });

  let notified = 0;
  for (let i = 0; i < userIds.length; i += 200) {
    const rows = userIds.slice(i, i + 200).map(id => ({
      user_id: id, actor_id: caller.id, kind: "system", title, body: text || null, link
    }));
    try { await rest("notifications", { method: "POST", token, body: rows }, base, key); notified += rows.length; } catch {}
  }

  let pushed = 0;
  if (pub && priv) {
    const payload = JSON.stringify({ title, body: text, url: link, tag: "terralens-notif" });
    for (const id of userIds) {
      let devices = [];
      try { devices = await rest("rpc/push_devices_for?p_user=" + encodeURIComponent(id), { token }, base, key); } catch { continue; }
      for (const device of (devices || [])) {
        try {
          const enc = encryptAes128gcm({ p256dh: device.p256dh, auth: device.auth }, null, payload);
          const headers = await vapidHeaders(device.endpoint, pub, priv, subject, true);
          const r = await fetch(device.endpoint, { method: "POST", headers, body: enc.body });
          if ([200, 201, 204].includes(r.status)) pushed++;
        } catch {}
      }
    }
  }
  return res.status(200).json({ ok: true, notified, pushed });
}
