import { clean } from "../_lib/env.js";

// Category photos for the homepage tiles.
//
// Unsplash is the wrong tool here: its demo key allows about 50 searches an hour, each
// search is a round trip, and the images it serves are slow on a phone connection.
// Wikimedia Commons is free, needs no key at all, has no quota worth worrying about for
// six lookups, and serves resized thumbnails from a CDN. Each photo carries its licence
// and author, which is what Commons requires and what a site using them should show.

const QUERIES = {
  Waterfall: "waterfall cascade",
  Mountain: "mountain summit landscape",
  Beach: "beach coast sea",
  Lake: "lake mountains reflection",
  Forest: "forest trees woodland",
  Culture: "temple heritage architecture"
};

// Files that are pictures of a place in name only: paintings, drawings, maps, diagrams,
// coats of arms. They are the reason a search for "mountain" returns a Bierstadt canvas.
const NOT_A_PHOTO = /painting|drawing|engraving|etching|map|diagram|coat of arms|logo|sketch|illustration|panorama of|\.svg$/i;
const BAD_WORDS = /painting|drawing|engraving|etching|diagram|coat of arms|logo|sketch|illustration/i;

async function searchCommons(query) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1200"
  });
  const r = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "TerraLens/1.0 (https://terralenss.vercel.app)" }
  });
  if (!r.ok) return [];
  const data = await r.json();
  const pages = Object.values(data?.query?.pages || {});
  const out = [];
  for (const p of pages) {
    const info = (p.imageinfo || [])[0];
    if (!info?.thumburl) continue;
    const title = p.title || "";
    const meta = info.extmetadata || {};
    const caption = `${title} ${(meta.ImageDescription || {}).value || ""}`;
    if (NOT_A_PHOTO.test(title) || BAD_WORDS.test(caption)) continue;
    // Landscape only: a tall portrait crop does not fit a tile.
    if ((info.width || 0) < (info.height || 0)) continue;
    const licence = (meta.LicenseShortName || {}).value || "See the file page for the licence";
    const author = String((meta.Artist || {}).value || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    out.push({
      url: info.thumburl.split("?")[0],
      alt: title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "").replace(/[_-]+/g, " "),
      credit: author || "Wikimedia Commons",
      link: info.descriptionurl || "",
      licence
    });
  }
  return out;
}

// Last resort so a tile is never an empty box: a plain colour matched to the category.
const FALLBACK = {
  Waterfall: "#0e3a4a",
  Mountain: "#1d2b3a",
  Beach: "#123a44",
  Lake: "#0f2f42",
  Forest: "#12331f",
  Culture: "#2a2135"
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const entries = await Promise.all(
    Object.entries(QUERIES).map(async ([category, query]) => {
      try {
        const results = await searchCommons(query);
        return results.length ? [category, results[0]] : null;
      } catch {
        return null;
      }
    })
  );

  const photos = Object.fromEntries(entries.filter(Boolean));
  const fallbacks = Object.fromEntries(
    Object.keys(QUERIES).filter(c => !photos[c]).map(c => [c, FALLBACK[c]])
  );

  // Commons photos barely change, so cache hard at the edge. A failed lookup is not cached
  // for long, so a temporary outage recovers on the next visit.
  res.setHeader(
    "Cache-Control",
    Object.keys(photos).length
      ? "public, s-maxage=604800, stale-while-revalidate=2592000"
      : "public, s-maxage=60"
  );
  return res.status(200).json({ photos, fallbacks });
}
