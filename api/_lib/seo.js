// Shared helpers for the server-rendered SEO pages (place pages, category pages, country pages, sitemaps).
import { clean, cleanUrl } from "./env.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
export const slugify = s => String(s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const siteUrl = req => cleanUrl("SITE_URL") || `https://${req.headers.host}`;
export const trunc = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…"; };
export const configured = () => !!(cleanUrl("SUPABASE_URL") && clean("SUPABASE_PUBLISHABLE_KEY"));

// Category names as stored in the database -> plural headings for landing pages.
export const CATEGORY_PLURAL = { Waterfall: "Waterfalls", Mountain: "Mountains", Beach: "Beaches", Lake: "Lakes", Forest: "Forests", Culture: "Cultural Sites", "National Park": "National Parks", Viewpoint: "Viewpoints", Other: "Places" };
export const CATEGORY_INTRO = {
  Waterfall: "From thundering cataracts to hidden jungle cascades, these are waterfalls worth planning a trip around. Each page covers the best season, the best time of day, how to get there and what it costs.",
  Mountain: "Peaks, treks and viewpoints for every level, from famous summits to quiet trails. Each page covers the best season, the best time of day, how to get there and what it costs.",
  Beach: "Soft sand, clear water and coastlines worth the journey. Each page covers the best season, the best time of day, how to get there and what it costs.",
  Lake: "Mirror-calm lakes, crater lakes and mountain water, with the best seasons and the easiest ways to reach them.",
  Forest: "Rainforests, ancient woods and cloud forests, with practical advice on seasons, access and permits.",
  Culture: "Temples, palaces, old towns and heritage sites, with tips on timing, tickets and getting there."
};

export function imgSize(url, w, q = 75) {
  try {
    const u = new URL(url);
    if (u.hostname !== "images.unsplash.com") return url;
    u.searchParams.set("w", String(w)); u.searchParams.set("q", String(q)); u.searchParams.set("auto", "format"); u.searchParams.set("fit", "max");
    return u.toString();
  } catch { return url; }
}

export async function rest(path, { count = false, headers = {} } = {}) {
  const r = await fetch(`${cleanUrl("SUPABASE_URL")}/rest/v1/${path}`, {
    headers: { apikey: clean("SUPABASE_PUBLISHABLE_KEY"), ...(count ? { Prefer: "count=exact" } : {}), ...headers }
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  const total = count ? Number((r.headers.get("content-range") || "").split("/")[1]) : null;
  return { rows: await r.json(), total: Number.isFinite(total) ? total : null };
}

// Category and country lists with counts. Uses the views from schema.sql and falls back to a plain query.
let cache = { at: 0, value: null };
export async function facets() {
  if (cache.value && Date.now() - cache.at < 300_000) return cache.value;
  let categories, countries;
  try {
    [categories, countries] = await Promise.all([rest("place_category_counts?select=category,places&order=places.desc"), rest("place_country_counts?select=country,places&order=places.desc")]);
    categories = categories.rows; countries = countries.rows;
  } catch {
    const { rows } = await rest("places?select=category,country&status=eq.published&limit=5000");
    const tally = key => Object.entries(rows.reduce((m, r) => (r[key] ? (m[r[key]] = (m[r[key]] || 0) + 1, m) : m), {})).map(([k, n]) => ({ [key]: k, places: n })).sort((a, b) => b.places - a.places);
    categories = tally("category"); countries = tally("country");
  }
  cache = { at: Date.now(), value: { categories, countries } };
  return cache.value;
}

export const placePath = p => `/place/${encodeURIComponent(p.slug)}`;
export const categoryPath = c => `/category/${slugify(c)}`;
export const countryPath = c => `/country/${slugify(c)}`;

// A static card (no JavaScript needed) for lists inside server-rendered pages.
export function cardHtml(p) {
  const img = p.cover_url ? `<img src="${esc(imgSize(p.cover_url, 640))}" srcset="${esc(imgSize(p.cover_url, 480))} 480w, ${esc(imgSize(p.cover_url, 800))} 800w" sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw" alt="${esc(p.name)}${p.country ? ", " + esc(p.country) : ""}" loading="lazy" decoding="async" class="h-full w-full object-cover">` : "";
  return `<article class="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]"><a href="${placePath(p)}" class="block aspect-[4/3] overflow-hidden bg-white/5" tabindex="-1" aria-hidden="true">${img}</a><div class="p-5"><div class="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-sky-300"><span>${esc(p.category || "Place")}</span><span>${esc(p.country || "")}</span></div><h3 class="font-display text-xl font-bold"><a href="${placePath(p)}">${esc(p.name)}</a></h3><p class="mt-2 line-clamp-2 text-sm leading-6 text-white/55">${esc(trunc(p.description, 140))}</p><div class="mt-4 flex justify-end"><a href="${placePath(p)}" class="tl-btn tl-btn-ghost !min-h-9 shrink-0 !px-4" aria-label="View ${esc(p.name)}">View</a></div></div></article>`;
}

export const jsonLd = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
export const breadcrumbLd = (site, crumbs) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c[0], item: site + c[1] })) });
export const breadcrumbHtml = crumbs => `<nav aria-label="Breadcrumb" class="mb-6 text-xs text-white/50"><ol class="flex flex-wrap items-center gap-2">${crumbs.map((c, i) => `<li>${i < crumbs.length - 1 ? `<a class="hover:text-white hover:underline" href="${esc(c[1])}">${esc(c[0])}</a><span class="ml-2" aria-hidden="true">/</span>` : `<span aria-current="page" class="text-white/70">${esc(c[0])}</span>`}</li>`).join("")}</ol></nav>`;

// Swaps head tags in an HTML template and fills the page body.
export function fillTemplate(html, { title, description, canonical, image, robots = "index,follow,max-image-preview:large,max-snippet:-1", ldBlocks = [], preload = "", body, ogType = "website" }) {
  const meta = `<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="${esc(robots)}">
<meta property="og:site_name" content="TerraLens"><meta property="og:locale" content="en_US"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="${ogType}">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">${image ? `<meta name="twitter:image" content="${esc(image)}">` : ""}
${preload}${ldBlocks.join("\n")}`;
  const swap = (re, text) => { html = html.replace(re, () => text); };
  swap(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  swap(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(description)}">`);
  swap(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`);
  swap(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(description)}">`);
  swap(/<meta property="og:type"[^>]*>/, "");
  swap(/<meta name="robots"[^>]*>/g, "");
  swap(/<meta property="og:image"[^>]*>/, image ? `<meta property="og:image" content="${esc(image)}">` : "");
  swap("</head>", `${meta}\n</head>`);
  swap(/<main[\s\S]*?<\/main>/, body);
  return html;
}
