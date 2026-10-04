export default function handler(req, res) {
  const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/+$/, "");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  res.status(200).send(`User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
}
