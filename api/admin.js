import imageAudit from "./_handlers/admin/image-audit.js";

// One function for admin-only server tasks (Hobby plan function cap).
// POST /api/admin?action=image-audit
const ROUTES = { "image-audit": imageAudit };

export default async function handler(req, res) {
  const action = String(req.query.action || "");
  const route = ROUTES[action];
  if (!route) return res.status(404).json({ error: "Unknown admin action" });
  return route(req, res);
}
