import { siteUrl } from "./_lib/seo.js";

export default function handler(req, res) {
  const site = siteUrl(req);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  // Private pages (login, profile, saved, upload, admin...) use "noindex" instead of Disallow, so search engines
  // can still see the instruction and drop them cleanly. Only the API is blocked.
  res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`);
}
