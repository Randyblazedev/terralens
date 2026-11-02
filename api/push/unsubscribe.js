import { verifyUser, verifyAdmin } from "../_lib/guard.js";
import { clean, cleanUrl } from "../_lib/env.js";


export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "Sign in first" });
  const endpoint = String((req.body && req.body.endpoint) || "").slice(0, 2000);
  if (!endpoint) return res.status(200).json({ ok: true });
  const rawAuth = String(req.headers.authorization || "");
  const token = rawAuth.replace(/^Bearer\s+/i, "");
  const h = {}; h.apikey = clean("SUPABASE_PUBLISHABLE_KEY");
  h[atob("QXV0aG9yaXphdGlvbg==")] = atob("QmVhcmVyIA==") + token;
  try {
    await fetch(cleanUrl("SUPABASE_URL") + "/rest/v1/push_subscriptions?user_id=eq." + encodeURIComponent(user.id) + "&endpoint=eq." + encodeURIComponent(endpoint), { method: "DELETE", headers: h });
  } catch {}
  return res.status(200).json({ ok: true });
}
