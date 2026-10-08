// Runs during the Vercel build. Needs SITE_URL (for example https://terralens.vercel.app).
// - turns relative social images into full URLs (scrapers need them)
// - adds a canonical link, og:url and extra social/robots tags to every indexable page
// - fills the site address into the home page's structured data
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const site = (process.env.SITE_URL || "").trim().replace(/["'`]+/g, "").replace(/\/+$/, "");
const pages = readdirSync(".").filter(n => n.endsWith(".html"));
const SKIP = new Set(["hub.html", "place.html", "404.html"]); // these are templates or error pages

if (!site || site.includes("YOUR-DOMAIN")) {
  console.log("SITE_URL not set: skipping canonical links and social image URLs (set it in Vercel for full SEO).");
  for (const f of pages) { // remove the unfinished structured data instead of publishing a placeholder
    const t = readFileSync(f, "utf8"), u = t.replace(/<script type="application\/ld\+json">[^<]*__SITE_URL__[^<]*<\/script>\n?/, "");
    if (u !== t) writeFileSync(f, u);
  }
  process.exit(0);
}

let changed = 0;
for (const f of pages) {
  let t = readFileSync(f, "utf8"); const before = t;
  t = t.replaceAll("__SITE_URL__", site);
  t = t.replace(/(<meta property="og:image" content=")(?!https?:)([^"]*)(")/, (_, a, p, c) => `${a}${site}/${p.replace(/^\//, "")}${c}`);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(t);
  if (!noindex && !SKIP.has(f) && !/rel="canonical"/.test(t)) {
    const path = f === "index.html" ? "/" : `/${f}`, url = site + path;
    const title = (t.match(/<title>([^<]*)<\/title>/) || [])[1] || "TerraLens";
    const desc = (t.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
    const extra = [`<link rel="canonical" href="${url}">`, `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">`,
      /og:url/.test(t) ? "" : `<meta property="og:url" content="${url}">`, /og:site_name/.test(t) ? "" : `<meta property="og:site_name" content="TerraLens">`,
      /og:locale/.test(t) ? "" : `<meta property="og:locale" content="en_US">`,
      /twitter:title/.test(t) ? "" : `<meta name="twitter:title" content="${title}">`, /twitter:description/.test(t) || !desc ? "" : `<meta name="twitter:description" content="${desc}">`].filter(Boolean).join("\n");
    t = t.replace("</head>", `${extra}\n</head>`);
  }
  if (t !== before) { writeFileSync(f, t); changed++; }
}
console.log(`SEO tags written for ${changed} pages using ${site}`);
