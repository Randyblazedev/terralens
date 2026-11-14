import { verifyAdmin } from "../../../_lib/guard.js";
import { clean, cleanUrl } from "../../../_lib/env.js";

// Autonomous admin worker: checks whether each place's cover image actually matches
// the place (name, category, country). Reports mismatches; never edits anything itself.
const AUTH_H = atob("QXV0aG9yaXphdGlvbg==");
const BEARER = atob("QmVhcmVyIA==");
const DEFAULT_VISION_MODEL = "openai/gpt-4o-mini";

function restHeaders(key, token) {
  const h = {};
  h.apikey = key;
  h[AUTH_H] = BEARER + token;
  return h;
}

async function fetchPlaces(limit, status) {
  const url = cleanUrl("SUPABASE_URL"), key = clean("SUPABASE_PUBLISHABLE_KEY");
  const sel = "id,slug,name,category,country,cover_url,status,created_by";
  let q = `${url}/rest/v1/places?select=${sel}&cover_url=not.is.null&order=created_at.desc&limit=${limit}`;
  if (status) q += `&status=eq.${status}`;
  const r = await fetch(q, { headers: restHeaders(key, clean("SUPABASE_SERVICE_KEY") || key) });
  if (!r.ok) throw new Error("places " + r.status);
  return r.json();
}

async function auditOne(place, model, key) {
  const prompt = [
    "You are a strict image reviewer for a travel place-discovery site.",
    `Place name: ${place.name}`,
    `Category: ${place.category || "unknown"}`,
    `Country: ${place.country || "unknown"}`,
    "",
    "Look at the attached photo and decide if it plausibly shows THIS place.",
    "Rules: a generic landscape that could be anywhere is a mismatch. A photo of the wrong country,",
    "wrong subject (e.g. a city skyline for a waterfall), a logo, a screenshot, a person's portrait,",
    "or obvious stock/AI filler is a mismatch.",
    'Reply with JSON only: {"verdict":"match"|"mismatch"|"unsure","confidence":0-100,"reason":"<=20 words"}'
  ].join("\n");

  const body = {
    model,
    temperature: 0,
    max_tokens: 160,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: place.cover_url } }
      ]
    }]
  };

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [AUTH_H]: BEARER + key,
      "HTTP-Referer": cleanUrl("SITE_URL") || "https://terralens.app",
      "X-Title": "TerraLens image audit"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) return { verdict: "error", confidence: 0, reason: "reviewer unavailable" };
  const j = await r.json().catch(() => ({}));
  const text = String(j?.choices?.[0]?.message?.content || "");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { verdict: "unsure", confidence: 0, reason: "no verdict returned" };
  try {
    const parsed = JSON.parse(m[0]);
    const verdict = ["match", "mismatch", "unsure"].includes(parsed.verdict) ? parsed.verdict : "unsure";
    return {
      verdict,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason || "").slice(0, 140)
    };
  } catch {
    return { verdict: "unsure", confidence: 0, reason: "unreadable verdict" };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: "Admins only" });

  const key = clean("OPENROUTER_API_KEY");
  if (!key) return res.status(503).json({ error: "The AI reviewer is not configured." });

  const limit = Math.max(1, Math.min(24, Number(req.body?.limit) || 12));
  const status = req.body?.status === "published" ? "published" : null;
  const model = clean("OPENROUTER_VISION_MODEL") || DEFAULT_VISION_MODEL;

  let places;
  try {
    places = await fetchPlaces(limit, status);
  } catch {
    return res.status(502).json({ error: "Could not load places. Try again." });
  }

  const findings = [];
  for (const p of places) {
    const verdict = await auditOne(p, model, key);
    findings.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      country: p.country,
      cover_url: p.cover_url,
      status: p.status,
      ...verdict
    });
  }

  const flagged = findings.filter(f => f.verdict === "mismatch" || f.verdict === "unsure");
  return res.status(200).json({
    ok: true,
    checked: findings.length,
    flagged: flagged.length,
    findings,
    flaggedOnly: flagged
  });
}
