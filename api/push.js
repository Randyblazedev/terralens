import config from "./_handlers/push/config.js";
import subscribe from "./_handlers/push/subscribe.js";
import unsubscribe from "./_handlers/push/unsubscribe.js";
import send from "./_handlers/push/send.js";

// One function for all Web Push routes, so the Hobby plan's function cap is respected.
// GET  /api/push?action=config
// POST /api/push?action=subscribe | unsubscribe | send
const ROUTES = { config, subscribe, unsubscribe, send };

export default async function handler(req, res) {
  const action = String(req.query.action || (req.method === "GET" ? "config" : "send"));
  const route = ROUTES[action];
  if (!route) return res.status(404).json({ error: "Unknown push action" });
  return route(req, res);
}
