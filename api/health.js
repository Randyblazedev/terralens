import { verifyAdmin } from "./_lib/guard.js";

// Admin-only setup check. Returns pass/fail messages only, never the secret values.
const probe = async (url, options = {}) => {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(7000) });
  } catch {
    return null;
  }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!(await verifyAdmin(req))) return res.status(403).json({ error: "Admins only." });

  const env = process.env;
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const url = env.SUPABASE_URL || "", key = env.SUPABASE_PUBLISHABLE_KEY || "", site = env.SITE_URL || "";
  add("SUPABASE_URL", /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url), url ? "Set." : "Missing.");
  add("SUPABASE_PUBLISHABLE_KEY", /^(sb_publishable_|eyJ)/.test(key), key ? "Set." : "Missing. It should start with sb_publishable_.");
  add("SITE_URL", /^https:\/\/[^/]+$/.test(site) && !site.includes("YOUR-DOMAIN"), site ? (/\/$/.test(site) ? "Remove the trailing slash." : "Set.") : "Missing. Example: https://yourproject.vercel.app");
  add("UNSPLASH_ACCESS_KEY", !!env.UNSPLASH_ACCESS_KEY, env.UNSPLASH_ACCESS_KEY ? "Set." : "Missing.");
  add("DEEPSEEK_API_KEY", !!env.DEEPSEEK_API_KEY, env.DEEPSEEK_API_KEY ? "Set." : "Missing.");
  add("Strict rate limits (optional)", !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN), env.UPSTASH_REDIS_REST_URL ? "Upstash connected." : "Not set. Using basic limits, which is fine for now.");

  const [db, auth, uns, ds] = await Promise.all([
    url && key ? probe(`${url.replace(/\/$/, "")}/rest/v1/places?select=id&limit=1`, { headers: { apikey: key } }) : null,
    url && key ? probe(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key } }) : null,
    env.UNSPLASH_ACCESS_KEY ? probe("https://api.unsplash.com/photos?per_page=1", { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } }) : null,
    env.DEEPSEEK_API_KEY ? probe("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` } }) : null
  ]);

  add("Supabase database reachable", db?.ok === true, !db ? "Could not reach it. Check the URL." : db.ok ? "Works." : `Rejected (status ${db.status}). Check the key and that schema.sql was run.`);
  if (auth?.ok) {
    const s = await auth.json().catch(() => ({}));
    add("Google sign-in enabled", s.external?.google === true, s.external?.google ? "On." : "Off. Enable Google under Authentication > Providers.");
    add("Email sign-in turned off", s.external?.email === false, s.external?.email ? "Still ON. Turn it off so only Google works." : "Off. Good.");
  } else {
    add("Sign-in providers", false, "Could not read the sign-in settings.");
  }
  add("Unsplash key works", uns?.ok === true, !uns ? "Skipped or unreachable." : uns.ok ? "Works." : `Rejected (status ${uns.status}). Check the Access Key.`);
  add("DeepSeek key works", ds?.ok === true, !ds ? "Skipped or unreachable." : ds.ok ? "Works." : `Rejected (status ${ds.status}). Check the key and your balance.`);

  return res.status(200).json({ checks });
}
