import { verifyUser, verifyAdmin } from "../_lib/guard.js";
import { clean, cleanUrl } from "../_lib/env.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = clean("VAPID_PUBLIC_KEY");
  if (!key) return res.status(503).json({ error: "Push is not configured yet" });
  return res.status(200).json({ publicKey: key });
}
