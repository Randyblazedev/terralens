import { verifyUser, rateLimit, clientIp } from "./_lib/guard.js";

// Accepts an image URL, validates it is a real remote image, and returns it for the
// client to store in Supabase Storage. No arbitrary file upload or proxying here.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "Sign in first" });
  if (!await rateLimit("moment-media:" + user.id, 20, 3600000)) return res.status(429).json({ error: "Upload limit reached" });
  const raw = String((req.body || {}).url || "").trim();
  let parsed;
  try { parsed = new URL(raw); } catch { return res.status(400).json({ error: "Invalid image URL" }); }
  if (parsed.protocol !== "https:") return res.status(400).json({ error: "Only HTTPS image links are allowed" });
  try {
    const head = await fetch(parsed.href, { method: "GET", headers: { Range: "bytes=0-262143" }, signal: AbortSignal.timeout(8000) });
    const type = String(head.headers.get("content-type") || "");
    if (!head.ok || !/^image\/(jpeg|png|webp|gif)$/.test(type)) return res.status(400).json({ error: "That link is not a supported image" });
    return res.status(200).json({ ok: true, url: parsed.href, contentType: type });
  } catch {
    return res.status(400).json({ error: "Could not load that image link" });
  }
}
