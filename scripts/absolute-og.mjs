// Social scrapers need a full URL for og:image. Runs during the Vercel build and
// rewrites the relative path using SITE_URL (no effect if SITE_URL is not set).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const site = (process.env.SITE_URL || "").replace(/\/+$/, "");
if (!site || site.includes("YOUR-DOMAIN")) { console.log("SITE_URL not set; skipping og:image rewrite"); process.exit(0); }
for (const f of readdirSync(".").filter(n => n.endsWith(".html"))) {
  const t = readFileSync(f, "utf8"), u = t.replace('content="assets/og-image.png"', `content="${site}/assets/og-image.png"`);
  if (u !== t) writeFileSync(f, u);
}
console.log("og:image set to", site);
