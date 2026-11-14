import categories from "./_handlers/photos/categories.js";
import place from "./_handlers/photos/place.js";

// One function for the photo helpers (Hobby plan function cap).
// GET /api/photos?action=categories | place
const ROUTES = { categories, place };

export default async function handler(req, res) {
  const action = String(req.query.action || "categories");
  const route = ROUTES[action];
  if (!route) return res.status(404).json({ error: "Unknown photos action" });
  return route(req, res);
}
