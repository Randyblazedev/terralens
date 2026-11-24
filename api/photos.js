import categories from "./_handlers/photos/categories.js";
import place from "./_handlers/photos/place.js";
import momentMedia from "./_handlers/photos/moment-media.js";

// One function for the photo helpers (Hobby plan function cap).
// GET /api/photos?action=categories | place
// POST /api/photos?action=moment-media
const ROUTES = { categories, place, "moment-media": momentMedia };

export default async function handler(req, res) {
  const action = String(req.query.action || "categories");
  const route = ROUTES[action];
  if (!route) return res.status(404).json({ error: "Unknown photos action" });
  return route(req, res);
}
