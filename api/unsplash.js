import search from "./_handlers/unsplash/search.js";
import download from "./_handlers/unsplash/download.js";
import categories from "./_handlers/unsplash/categories.js";

// One function for all Unsplash routes (Hobby plan function cap).
// GET  /api/unsplash?action=search | categories
// POST /api/unsplash?action=download
const ROUTES = { search, download, categories };

export default async function handler(req, res) {
  const action = String(req.query.action || "search");
  const route = ROUTES[action];
  if (!route) return res.status(404).json({ error: "Unknown unsplash action" });
  return route(req, res);
}
