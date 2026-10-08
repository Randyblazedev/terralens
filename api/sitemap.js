import { esc, siteUrl, configured, rest, facets, categoryPath, countryPath, placePath } from "./_lib/seo.js";

// Sitemap index at /sitemap.xml. Part 0 lists the main pages plus every category and country page;
// parts 1, 2, 3... list places, 2,000 per file, so the site can grow to millions of places.
const PER = 2000;
const STATIC_PAGES = ["/", "/explore.html", "/collections.html", "/planner.html", "/about.html", "/terms.html", "/privacy.html", "/content-policy.html"];
const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';

export default async function handler(req, res) {
  const site = siteUrl(req), part = req.query.part === undefined ? null : parseInt(req.query.part, 10);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  try {
    if (part === null) {
      let total = 0;
      if (configured()) { try { total = (await rest("places?select=id&status=eq.published&limit=1", { count: true })).total || 0; } catch {} }
      const files = ["/sitemap-0.xml", ...Array.from({ length: Math.ceil(total / PER) }, (_, i) => `/sitemap-${i + 1}.xml`)];
      return res.status(200).send(`${XML}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map(f => `<sitemap><loc>${esc(site + f)}</loc></sitemap>`).join("\n")}\n</sitemapindex>`);
    }
    if (!Number.isInteger(part) || part < 0) return res.status(404).send(`${XML}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);

    if (part === 0) {
      let paths = [...STATIC_PAGES];
      if (configured()) { try { const f = await facets(); paths = [...paths, ...f.categories.map(c => categoryPath(c.category)), ...f.countries.map(c => countryPath(c.country))]; } catch {} }
      return res.status(200).send(`${XML}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p => `<url><loc>${esc(site + p)}</loc></url>`).join("\n")}\n</urlset>`);
    }

    const { rows } = configured() ? await rest(`places?select=slug,name,cover_url,created_at,updated_at&status=eq.published&order=created_at.asc&limit=${PER}&offset=${(part - 1) * PER}`) : { rows: [] };
    const urls = rows.map(p => {
      const last = (p.updated_at || p.created_at || "").slice(0, 10);
      return `<url><loc>${esc(site + placePath(p))}</loc>${last ? `<lastmod>${last}</lastmod>` : ""}${p.cover_url ? `<image:image><image:loc>${esc(p.cover_url)}</image:loc><image:title>${esc(p.name)}</image:title></image:image>` : ""}</url>`;
    });
    return res.status(200).send(`${XML}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>`);
  } catch {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send(`${XML}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
  }
}
