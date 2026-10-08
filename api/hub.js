import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esc, slugify, siteUrl, trunc, configured, CATEGORY_PLURAL, CATEGORY_INTRO, imgSize, rest, facets, placePath, categoryPath, countryPath, cardHtml, jsonLd, breadcrumbLd, breadcrumbHtml, fillTemplate } from "./_lib/seo.js";

// Server-rendered landing pages: /category/:slug (for example /category/waterfall) and /country/:slug.
// These are the pages that can rank for searches like "best waterfalls" or "places to visit in Cameroon".
const PAGE = 24;
let template;
const loadTemplate = () => (template ??= readFileSync(join(process.cwd(), "hub.html"), "utf8"));

function notFound(res, site, html) {
  const body = `<main class="tl-section"><div class="tl-shell max-w-2xl text-center"><h1 class="text-4xl font-extrabold">We could not find that page</h1><p class="mt-4 text-white/55">It may have moved. Try exploring all places instead.</p><a href="/explore.html" class="tl-btn tl-btn-primary mt-8">Explore places</a></div></main>`;
  res.setHeader("Cache-Control", "public, s-maxage=60");
  return res.status(404).send(fillTemplate(html, { title: "Page not found | TerraLens", description: "This page could not be found on TerraLens.", canonical: site + "/", robots: "noindex", body }));
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const html = loadTemplate(), site = siteUrl(req);
  if (!configured()) return notFound(res, site, html);

  const type = req.query.type === "country" ? "country" : "category";
  const slug = slugify(req.query.slug);
  const page = Math.min(500, Math.max(1, parseInt(req.query.page, 10) || 1));
  try {
    const { categories, countries } = await facets();
    const match = type === "category" ? categories.find(c => slugify(c.category) === slug) : countries.find(c => slugify(c.country) === slug);
    if (!match) return notFound(res, site, html);
    const name = type === "category" ? match.category : match.country;
    const filter = `${type}=eq.${encodeURIComponent(name)}`;
    const offset = (page - 1) * PAGE;
    const { rows, total } = await rest(`places?select=slug,name,category,country,description,cover_url,created_at&status=eq.published&${filter}&order=featured.desc,created_at.desc&limit=${PAGE}&offset=${offset}`, { count: true });
    if (!rows.length) return notFound(res, site, html);
    const count = total ?? match.places ?? rows.length;
    const pages = Math.max(1, Math.ceil(count / PAGE));

    const plural = type === "category" ? (CATEGORY_PLURAL[name] || name + "s") : "";
    const basePath = type === "category" ? categoryPath(name) : countryPath(name);
    const h1 = type === "category" ? `Best ${plural} to Visit` : `Places to Visit in ${name}`;
    let intro;
    if (type === "category") intro = CATEGORY_INTRO[name] || `Explore ${plural.toLowerCase()} from around the world, with photos and practical details for every place.`;
    else {
      const { rows: cats } = await rest(`places?select=category&status=eq.published&country=eq.${encodeURIComponent(name)}&limit=1000`);
      const tally = Object.entries(cats.reduce((m, r) => (r.category ? (m[r.category] = (m[r.category] || 0) + 1, m) : m), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const summary = tally.length ? `, including ${tally.map(([c, n]) => `${n} ${(CATEGORY_PLURAL[c] || c + "s").toLowerCase()}`).join(", ")}` : "";
      intro = `TerraLens lists ${count} place${count === 1 ? "" : "s"} to visit in ${name}${summary}. Every place has photos, the best season and time to go, how to get there and what it costs.`;
    }
    const title = trunc(`${type === "category" ? `Best ${plural} to Visit: ${count} Places` : `Places to Visit in ${name}: ${count} Spots`}${page > 1 ? ` (Page ${page})` : ""} | TerraLens`, 62);
    const description = trunc(type === "category"
      ? `Explore ${count} ${plural.toLowerCase()} with photos, best season, best time, how to get there and entry fees. ${intro.split(". ")[0]}.`
      : `Discover ${count} place${count === 1 ? "" : "s"} to visit in ${name}. See photos, the best season, how to get there and entry fees for each.`, 158);
    const canonical = site + basePath + (page > 1 ? `?page=${page}` : "");
    const crumbs = [["Home", "/"], ["Explore", "/explore.html"], [type === "category" ? plural : `Places in ${name}`, basePath]];
    const image = rows[0].cover_url ? imgSize(rows[0].cover_url, 1200) : site + "/assets/og-image.png";

    const nums = [];
    for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p);
    const href = p => basePath + (p > 1 ? `?page=${p}` : "");
    const pagination = pages > 1 ? `<nav aria-label="Pagination" class="mt-10 flex flex-wrap items-center justify-center gap-2">${page > 1 ? `<a class="tl-btn tl-btn-ghost !min-h-10" rel="prev" href="${href(page - 1)}">Previous</a>` : ""}${nums.map(p => p === page ? `<span aria-current="page" class="tl-btn tl-btn-primary !min-h-10">${p}</span>` : `<a class="tl-btn tl-btn-ghost !min-h-10" href="${href(p)}">${p}</a>`).join("")}${page < pages ? `<a class="tl-btn tl-btn-ghost !min-h-10" rel="next" href="${href(page + 1)}">Next</a>` : ""}</nav>` : "";

    const catLinks = categories.map(c => `<a class="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10" href="${categoryPath(c.category)}">${esc(CATEGORY_PLURAL[c.category] || c.category)} <span class="text-white/40">${c.places}</span></a>`).join("");
    const countryLinks = countries.slice(0, 40).map(c => `<a class="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10" href="${countryPath(c.country)}">${esc(c.country)} <span class="text-white/40">${c.places}</span></a>`).join("");

    const body = `<main class="tl-section"><div class="tl-shell">${breadcrumbHtml(crumbs)}<p class="tl-eyebrow">${type === "category" ? "Category" : "Destination"}</p><h1 class="mt-3 text-4xl font-extrabold sm:text-5xl">${esc(h1)}</h1><p class="mt-4 max-w-3xl leading-7 text-white/60">${esc(intro)}</p><p class="mt-2 text-sm text-white/40">${count} place${count === 1 ? "" : "s"}${pages > 1 ? ` · page ${page} of ${pages}` : ""}</p><div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">${rows.map(cardHtml).join("")}</div>${pagination}<section class="mt-16"><h2 class="text-xl font-bold">Browse by category</h2><div class="mt-4 flex flex-wrap gap-2">${catLinks}</div><h2 class="mt-10 text-xl font-bold">Browse by country</h2><div class="mt-4 flex flex-wrap gap-2">${countryLinks}</div></section></div></main>`;

    const ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: h1, url: canonical, description, isPartOf: { "@type": "WebSite", name: "TerraLens", url: site + "/" } },
      { "@context": "https://schema.org", "@type": "ItemList", itemListElement: rows.map((p, i) => ({ "@type": "ListItem", position: offset + i + 1, url: site + placePath(p), name: p.name, ...(p.cover_url ? { image: imgSize(p.cover_url, 800) } : {}) })) },
      breadcrumbLd(site, crumbs)
    ];
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(fillTemplate(html, { title, description, canonical, image, ldBlocks: ld.map(jsonLd), body }));
  } catch {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send(fillTemplate(html, { title: "Temporarily unavailable | TerraLens", description: "Please try again in a moment.", canonical: site + "/", robots: "noindex", body: `<main class="tl-section"><div class="tl-shell max-w-2xl text-center"><h1 class="text-4xl font-extrabold">Please try again</h1><p class="mt-4 text-white/55">This page could not load right now.</p></div></main>` }));
  }
}
