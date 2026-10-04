import { clean, cleanUrl } from "./_lib/env.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Server-renders /place/:slug so search engines and link previews get real title,
// description, Open Graph tags, JSON-LD and content without running JavaScript.
// The normal client script in place.html then takes over.
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/i;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
let template;
const loadTemplate = () => (template ??= readFileSync(join(process.cwd(), "place.html"), "utf8"));

async function rest(path) {
  const r = await fetch(`${cleanUrl("SUPABASE_URL")}/rest/v1/${path}`, { headers: { apikey: clean("SUPABASE_PUBLISHABLE_KEY") } });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  let html = loadTemplate();
  const site = cleanUrl("SITE_URL") || `https://${req.headers.host}`;

  // Demo mode (no database): let the browser script handle everything.
  if (!cleanUrl("SUPABASE_URL") || !clean("SUPABASE_PUBLISHABLE_KEY")) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);
  }

  const slug = String(req.query.slug || "");
  let place = null, images = [];
  if (SLUG.test(slug)) {
    try {
      place = (await rest(`places?select=*&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`))[0] || null;
      if (place) images = await rest(`place_images?select=image_url&place_id=eq.${place.id}&order=created_at.asc&limit=10`);
    } catch {
      res.setHeader("Cache-Control", "no-store"); // database hiccup: let the client try
      return res.status(200).send(html);
    }
  }

  if (!place) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(404).send(html.replace("</head>", '<meta name="robots" content="noindex">\n</head>'));
  }

  const url = `${site}/place/${encodeURIComponent(place.slug)}`;
  const desc = String(place.description || "").slice(0, 155);
  const image = images[0]?.image_url || place.cover_url || "";
  const title = `${place.name} — TerraLens`;
  const where = [place.city, place.region, place.country].filter(Boolean).join(", ");
  const ld = {
    "@context": "https://schema.org", "@type": "TouristAttraction", name: place.name, description: place.description,
    image: [image, ...images.map(i => i.image_url)].filter(Boolean).slice(0, 5), url,
    ...(place.latitude != null && place.longitude != null ? { geo: { "@type": "GeoCoordinates", latitude: place.latitude, longitude: place.longitude } } : {}),
    address: { "@type": "PostalAddress", addressLocality: place.city || undefined, addressRegion: place.region || undefined, addressCountry: place.country || undefined }
  };

  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}">`)
    .replace(/<meta property="og:type"[^>]*>/, '<meta property="og:type" content="article">')
    .replace(/<meta property="og:image"[^>]*>/, image ? `<meta property="og:image" content="${esc(image)}">` : "")
    .replace("</head>", `<link rel="canonical" href="${esc(url)}">\n<meta property="og:url" content="${esc(url)}">\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n</head>`)
    .replace('<div id="place"></div>', `<div id="place"><article class="tl-shell py-16"><h1 class="text-4xl font-extrabold">${esc(place.name)}</h1><p class="mt-3 text-sm text-white/55">${esc([place.category, where].filter(Boolean).join(" · "))}</p><p class="mt-6 max-w-3xl text-lg leading-8 text-white/60">${esc(place.description)}</p>${image ? `<img src="${esc(image)}" alt="${esc(place.name)}" class="mt-8 w-full rounded-3xl object-cover">` : ""}</article></div>`);

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).send(html);
}
