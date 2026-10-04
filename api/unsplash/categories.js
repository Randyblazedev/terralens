// One real photo per home-page category, fetched from Unsplash with YOUR key on the server
// and cached for a day (so it uses ~6 requests/day of the 50/hour demo limit).
const QUERIES = {
  Waterfall: "waterfall nature",
  Mountain: "mountain landscape",
  Beach: "tropical beach",
  Lake: "lake scenic",
  Forest: "forest trees nature",
  Culture: "cultural heritage architecture"
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return res.status(200).json({ photos: {} });

  const entries = await Promise.all(Object.entries(QUERIES).map(async ([category, query]) => {
    try {
      const params = new URLSearchParams({ query, per_page: "1", orientation: "landscape", content_filter: "high" });
      const r = await fetch(`https://api.unsplash.com/search/photos?${params}`, { headers: { Authorization: `Client-ID ${key}` } });
      if (!r.ok) return null;
      const photo = (await r.json()).results?.[0];
      if (!photo?.urls?.small) return null;
      return [category, {
        url: photo.urls.small,
        alt: photo.alt_description || photo.description || category,
        credit: photo.user?.name || "Unsplash photographer",
        link: photo.user?.links?.html ? `${photo.user.links.html}?utm_source=terralens&utm_medium=referral` : ""
      }];
    } catch { return null; }
  }));

  const photos = Object.fromEntries(entries.filter(Boolean));
  res.setHeader("Cache-Control", Object.keys(photos).length ? "public, s-maxage=86400, stale-while-revalidate=604800" : "no-store");
  return res.status(200).json({ photos });
}
