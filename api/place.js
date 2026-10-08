import { readFileSync } from "node:fs";
import { join } from "node:path";
import { esc, siteUrl, trunc, configured, CATEGORY_PLURAL, imgSize, rest, placePath, categoryPath, countryPath, cardHtml, jsonLd, breadcrumbLd, breadcrumbHtml, fillTemplate } from "./_lib/seo.js";

// Server-renders /place/:slug so search engines and link previews get a real title, description,
// Open Graph tags, structured data, internal links and the full content without running JavaScript.
// The normal client script in place.html then takes over the #place box.
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/i;
let template;
const loadTemplate = () => (template ??= readFileSync(join(process.cwd(), "place.html"), "utf8"));
const FIELDS = "slug,name,category,country,description,cover_url,created_at";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const html = loadTemplate(), site = siteUrl(req);

  // Demo mode (no database): let the browser script handle everything.
  if (!configured()) { res.setHeader("Cache-Control", "no-store"); return res.status(200).send(html); }

  const slug = String(req.query.slug || "");
  let place = null, images = [], related = [];
  if (SLUG.test(slug)) {
    try {
      place = (await rest(`places?select=*&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`)).rows[0] || null;
      if (place) {
        const enc = encodeURIComponent;
        const [im, byCat, byCountry] = await Promise.all([
          rest(`place_images?select=image_url,alt_text,credit_name,credit_url&place_id=eq.${place.id}&order=created_at.asc&limit=10`),
          place.category ? rest(`places?select=${FIELDS}&status=eq.published&category=eq.${enc(place.category)}&slug=neq.${enc(place.slug)}&order=featured.desc,created_at.desc&limit=6`) : { rows: [] },
          place.country ? rest(`places?select=${FIELDS}&status=eq.published&country=eq.${enc(place.country)}&slug=neq.${enc(place.slug)}&order=featured.desc,created_at.desc&limit=6`) : { rows: [] }
        ]);
        images = im.rows;
        const seen = new Set();
        related = [...byCountry.rows, ...byCat.rows].filter(p => !seen.has(p.slug) && seen.add(p.slug)).slice(0, 6);
      }
    } catch {
      res.setHeader("Cache-Control", "no-store"); // database hiccup: let the client try
      return res.status(200).send(html);
    }
  }

  if (!place) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(404).send(html.replace("</head>", '<meta name="robots" content="noindex">\n</head>'));
  }

  const url = `${site}${placePath(place)}`;
  const hero = images[0]?.image_url || place.cover_url || "";
  const gallery = (images.length ? images : place.cover_url ? [{ image_url: place.cover_url }] : []).slice(0, 6);
  const where = [place.city, place.region, place.country].filter(Boolean).join(", ");
  const plural = CATEGORY_PLURAL[place.category] || (place.category ? place.category + "s" : "");

  // Title: aim for 60 characters or fewer so it is not cut off in search results.
  const titleOptions = [`${place.name} (${place.country}): Travel Guide | TerraLens`, `${place.name} Travel Guide | TerraLens`];
  const title = titleOptions.find(t => t.length <= 62 && place.country) || trunc(titleOptions[1], 62);
  const lead = String(place.description || "").split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  const extras = [place.best_season ? `Best time to visit: ${place.best_season}.` : "", place.entry_fee ? `Entry: ${place.entry_fee}.` : ""].filter(Boolean).join(" ");
  const description = trunc(`${trunc(lead, 110)} ${extras}`.trim() || place.description || place.name, 158);

  const crumbs = [["Home", "/"], ["Explore", "/explore.html"], ...(place.category ? [[plural, categoryPath(place.category)]] : []), ...(place.country ? [[place.country, countryPath(place.country)]] : []), [place.name, placePath(place)]];
  const free = /^\s*(free|no entry fee)\b/i.test(place.entry_fee || "");
  const ld = [
    {
      "@context": "https://schema.org", "@type": "TouristAttraction", "@id": url + "#place", name: place.name, description: place.description, url,
      ...(gallery.length ? { image: gallery.map(g => ({ "@type": "ImageObject", url: g.image_url, caption: g.alt_text || `${place.name}, ${place.country || ""}`.trim() })) } : {}),
      ...(place.latitude != null && place.longitude != null ? { geo: { "@type": "GeoCoordinates", latitude: place.latitude, longitude: place.longitude } } : {}),
      address: { "@type": "PostalAddress", addressLocality: place.city || undefined, addressRegion: place.region || undefined, addressCountry: place.country || undefined },
      ...(free ? { isAccessibleForFree: true } : {}),
      ...(place.updated_at ? { dateModified: place.updated_at } : {}), datePublished: place.created_at
    },
    breadcrumbLd(site, crumbs)
  ];

  const fact = (k, v) => v ? `<div class="rounded-2xl border border-white/10 bg-white/[.03] p-4"><dt class="text-xs font-bold uppercase tracking-[.14em] text-sky-300">${k}</dt><dd class="mt-1 text-sm leading-6 text-white/70">${esc(v)}</dd></div>` : "";
  const credits = gallery.filter(g => g.credit_name);
  const article = `<article class="tl-shell py-10">${breadcrumbHtml(crumbs)}<h1 class="text-4xl font-extrabold sm:text-5xl">${esc(place.name)}</h1><p class="mt-3 text-sm text-white/55">${esc([place.category, where].filter(Boolean).join(" · "))}</p><p class="mt-6 max-w-3xl text-lg leading-8 text-white/65">${esc(place.description)}</p>${hero ? `<img src="${esc(imgSize(hero, 1200))}" srcset="${esc(imgSize(hero, 640))} 640w, ${esc(imgSize(hero, 1200))} 1200w, ${esc(imgSize(hero, 1800))} 1800w" sizes="(min-width:1024px) 1100px, 100vw" width="1200" height="800" fetchpriority="high" alt="${esc(gallery[0]?.alt_text || `${place.name}, ${place.country || ""}`)}" class="mt-8 w-full rounded-3xl object-cover">` : ""}<dl class="mt-8 grid gap-3 sm:grid-cols-2">${fact("Best season", place.best_season)}${fact("Best time of day", place.best_time)}${fact("How to get there", place.access_info)}${fact("Entry fee", place.entry_fee)}</dl>${gallery.length > 1 ? `<div class="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${gallery.slice(1).map(g => `<img src="${esc(imgSize(g.image_url, 640))}" alt="${esc(g.alt_text || `${place.name}, ${place.country || ""}`)}" loading="lazy" decoding="async" width="640" height="480" class="aspect-[4/3] w-full rounded-2xl object-cover">`).join("")}</div>` : ""}${credits.length ? `<p class="mt-3 text-xs text-white/40">Photos: ${credits.map(c => esc(c.credit_name)).join(", ")} on Unsplash</p>` : ""}</article>`;

  const more = `<section id="seo-extra" class="tl-shell pb-20"><h2 class="text-2xl font-extrabold">More places to explore</h2>${related.length ? `<div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">${related.map(cardHtml).join("")}</div>` : ""}<div class="mt-8 flex flex-wrap gap-2">${place.category ? `<a class="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10" href="${categoryPath(place.category)}">All ${esc(plural.toLowerCase())}</a>` : ""}${place.country ? `<a class="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10" href="${countryPath(place.country)}">Places in ${esc(place.country)}</a>` : ""}<a class="rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/10" href="/explore.html">Explore all places</a></div></section>`;

  const mainOpen = (html.match(/<main[^>]*>/) || ["<main>"])[0];
  const body = `${mainOpen}<div id="place">${article}</div>${more}</main>`;
  const preload = hero ? `<link rel="preload" as="image" href="${esc(imgSize(hero, 1200))}" imagesrcset="${esc(imgSize(hero, 640))} 640w, ${esc(imgSize(hero, 1200))} 1200w, ${esc(imgSize(hero, 1800))} 1800w" imagesizes="(min-width:1024px) 1100px, 100vw" fetchpriority="high">\n` : "";

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).send(fillTemplate(html, { title, description, canonical: url, image: hero ? imgSize(hero, 1200) : site + "/assets/og-image.png", ogType: "article", preload, ldBlocks: ld.map(jsonLd), body }));
}
