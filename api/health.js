import { verifyAdmin } from "./_lib/guard.js";
import { clean, cleanUrl } from "./_lib/env.js";

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
  if (!cleanUrl("SUPABASE_URL") || !clean("SUPABASE_PUBLISHABLE_KEY")) {
    return res.status(500).json({ error: "The server cannot see SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. In Vercel, add them for Production (no spaces, no quotes), then redeploy." });
  }
  if (!(await verifyAdmin(req))) return res.status(403).json({ error: "The server could not confirm you are an admin. Sign out, sign in with Google again, and check that your email is in the admins table." });

  const env = new Proxy({}, { get: (_, name) => (name === "SUPABASE_URL" || name === "SITE_URL" ? cleanUrl(name) : clean(name)) });
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const url = env.SUPABASE_URL || "", key = env.SUPABASE_PUBLISHABLE_KEY || "", site = env.SITE_URL || "";
  add("SUPABASE_URL", /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url), url ? "Set." : "Missing.");
  add("SUPABASE_PUBLISHABLE_KEY", /^(sb_publishable_|eyJ)/.test(key), key ? "Set." : "Missing. It should start with sb_publishable_.");
  add("SITE_URL", /^https:\/\/[^/]+$/.test(site) && !site.includes("YOUR-DOMAIN"), site ? (/\/$/.test(site) ? "Remove the trailing slash." : "Set.") : "Missing. Example: https://yourproject.vercel.app");
  add("UNSPLASH_ACCESS_KEY", !!env.UNSPLASH_ACCESS_KEY, env.UNSPLASH_ACCESS_KEY ? "Set." : "Missing.");
  add("OPENROUTER_API_KEY", !!env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEY ? "Set." : "Missing. Create a key at openrouter.ai/keys and add it in Vercel.");
  add("Strict rate limits (optional)", true, env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? "Upstash connected." : "Optional and not set. Basic limits are active, which is fine for now.");

  const [db, auth, uns, ds] = await Promise.all([
    url && key ? probe(`${url.replace(/\/$/, "")}/rest/v1/places?select=id&limit=1`, { headers: { apikey: key } }) : null,
    url && key ? probe(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key } }) : null,
    env.UNSPLASH_ACCESS_KEY ? probe("https://api.unsplash.com/photos?per_page=1", { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } }) : null,
    env.OPENROUTER_API_KEY ? probe("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } }) : null
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
  if (ds?.ok) {
    const k = (await ds.json().catch(() => ({}))).data || {};
    const out = k.limit_remaining != null && k.limit_remaining <= 0;
    add("OpenRouter key works", !out, out ? "The key's credit limit is used up. Add credit at openrouter.ai." : k.is_free_tier ? "Works (free tier: limited requests)." : "Works.");
  } else {
    add("OpenRouter key works", false, !ds ? "Skipped or unreachable." : `Rejected (status ${ds.status}). Check the key.`);
  }

  return res.status(200).json({ checks });
}
