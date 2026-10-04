import { clean } from "../_lib/env.js";
import { clientIp, rateLimit } from "../_lib/guard.js";

const ORIENTATIONS = new Set(["landscape", "portrait", "squarish"]);
const ORDERS = new Set(["relevant", "latest"]);
const clamp = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!(await rateLimit(`unsplash:${clientIp(req)}`, 30, 60_000))) return res.status(429).json({ error: "Too many searches. Try again soon." });

  const key = clean("UNSPLASH_ACCESS_KEY");
  if (!key) return res.status(500).json({ error: "Image search is not configured." });

  const query = String(req.query.query || "").trim().slice(0, 100);
  if (!query) return res.status(400).json({ error: "query is required" });

  const params = new URLSearchParams({
    query,
    page: String(clamp(req.query.page, 1, 50, 1)),
    per_page: String(clamp(req.query.per_page, 1, 30, 12)),
    orientation: ORIENTATIONS.has(req.query.orientation) ? req.query.orientation : "landscape",
    order_by: ORDERS.has(req.query.order_by) ? req.query.order_by : "relevant"
  });

  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?${params}`, { headers: { Authorization: `Client-ID ${key}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status === 403 ? 429 : 502).json({ error: "Image search failed." });

    const results = (data.results || []).map(photo => ({
      id: photo.id,
      width: photo.width,
      height: photo.height,
      description: photo.description || photo.alt_description || "",
      urls: photo.urls,
      links: { html: photo.links?.html, download_location: photo.links?.download_location },
      user: { name: photo.user?.name, username: photo.user?.username, profile: photo.user?.links?.html },
      location: photo.location
    }));

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ results, total: data.total, total_pages: data.total_pages });
  } catch {
    return res.status(502).json({ error: "Unable to reach the image service." });
  }
}
