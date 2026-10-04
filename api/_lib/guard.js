import { clean, cleanUrl } from "./env.js";
// Shared helpers for API routes. Files starting with "_" are not deployed as routes.
const buckets = new Map();

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim();
  return first || req.socket?.remoteAddress || "unknown";
}

// Rate limiter. If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set it is
// shared across all serverless instances (strict). Otherwise it falls back to
// per-instance memory, which slows abuse but is not a hard guarantee.
export async function rateLimit(key, limit, windowMs) {
  const upUrl = cleanUrl("UPSTASH_REDIS_REST_URL"), upToken = clean("UPSTASH_REDIS_REST_TOKEN");
  if (upUrl && upToken) {
    try {
      const r = await fetch(`${upUrl}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upToken}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", `rl:${key}`], ["PEXPIRE", `rl:${key}`, String(windowMs), "NX"]])
      });
      const out = await r.json();
      const count = Number(out?.[0]?.result);
      if (r.ok && Number.isFinite(count)) return count <= limit;
    } catch {}
  }
  return memoryLimit(key, limit, windowMs);
}

function memoryLimit(key, limit, windowMs) {
  const now = Date.now();
  const hit = buckets.get(key);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  if (!hit || now > hit.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= limit;
}

// Verifies the caller's Supabase access token and returns the user, or null.
export async function verifyUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const url = cleanUrl("SUPABASE_URL");
  const key = clean("SUPABASE_PUBLISHABLE_KEY");
  if (!token || !url || !key) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

// True only if the caller's token belongs to a confirmed admin (checked by the database).
export async function verifyAdmin(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const url = cleanUrl("SUPABASE_URL");
  const key = clean("SUPABASE_PUBLISHABLE_KEY");
  if (!token || !url || !key) return false;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}"
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}
