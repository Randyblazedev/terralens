const STATIC_PAGES = ["", "explore.html", "about.html", "collections.html", "planner.html"];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

export default async function handler(req, res) {
  const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/+$/, "");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  let places = [];
  if (url && key) {
    try {
      const r = await fetch(`${url}/rest/v1/places?select=slug,updated_at&status=eq.published&order=updated_at.desc&limit=5000`, { headers: { apikey: key } });
      if (r.ok) places = await r.json();
    } catch {}
  }
  const urls = [
    ...STATIC_PAGES.map(p => `<url><loc>${esc(`${site}/${p}`)}</loc></url>`),
    ...places.map(p => `<url><loc>${esc(`${site}/place/${encodeURIComponent(p.slug)}`)}</loc>${p.updated_at ? `<lastmod>${esc(p.updated_at.slice(0, 10))}</lastmod>` : ""}</url>`)
  ];
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
}
