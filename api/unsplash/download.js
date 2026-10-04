import { clientIp, rateLimit, verifyAdmin } from "../_lib/guard.js";

// Unsplash requires apps to report when a photo is used. Admin-only so keys and quota stay safe.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await rateLimit(`unsplash-dl:${clientIp(req)}`, 30, 60_000))) return res.status(429).json({ error: "Too many requests." });
  if (!(await verifyAdmin(req))) return res.status(403).json({ error: "Admins only." });

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return res.status(500).json({ error: "Image service is not configured." });
  const target = String(req.body?.download_location || "");
  if (!/^https:\/\/api\.unsplash\.com\/photos\/[A-Za-z0-9_-]+\/download(\?.*)?$/.test(target)) return res.status(400).json({ error: "Invalid download_location." });

  try {
    const r = await fetch(target, { headers: { Authorization: `Client-ID ${key}` } });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch {
    return res.status(502).json({ error: "Unable to reach the image service." });
  }
}
