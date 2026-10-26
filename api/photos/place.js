import { clean } from "../_lib/env.js";
import { rateLimit, clientIp } from "../_lib/guard.js";

// Finds a real photo of one specific place on Wikimedia Commons.
//
// Unsplash search returns generic stock ("a mountain"), not the place itself, so a page
// about Gullfoss could show a random cliff. Commons is indexed by the place's own name and
// its photos carry a licence and an author, which the site shows as credit.

const NOT_A_PHOTO = /painting|drawing|engraving|etching|\bmap\b|diagram|coat of arms|logo|sketch|illustration|poster|stamp|banknote/i;
const BAD_CAPTION = /painting|drawing|engraving|etching|diagram|coat of arms|logo|sketch|illustration|poster|stamp/i;

async function commonsSearch(term, limit = 8) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${term} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1600"
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
    if (NOT_A_PHOTO.test(title) || BAD_CAPTION.test(caption)) continue;
    if ((info.width || 0) < (info.height || 0)) continue;
    out.push({
      url: info.thumburl.split("?")[0],
      full: (info.url || "").split("?")[0],
      alt: title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "").replace(/[_-]+/g, " "),
      credit: String((meta.Artist || {}).value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || "Wikimedia Commons",
      credit_url: info.descriptionurl || "",
      licence: (meta.LicenseShortName || {}).value || "See the file page for the licence"
    });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ip = clientIp(req);
  if (!(await rateLimit(`photos:${ip}`, 60, 60_000))) {
    return res.status(429).json({ error: "Too many lookups. Wait a minute and try again." });
  }

  const name = String(req.query.name || "").trim().slice(0, 120);
  const country = String(req.query.country || "").trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: "A place name is required." });

  const attempts = [`${name} ${country}`.trim(), name];
  let photos = [];
  for (const term of attempts) {
    try {
      photos = await commonsSearch(term);
    } catch {
      photos = [];
    }
    if (photos.length) break;
  }

  res.setHeader("Cache-Control", photos.length ? "public, s-maxage=604800" : "public, s-maxage=300");
  return res.status(200).json({ photos, query: attempts[0] });
}
