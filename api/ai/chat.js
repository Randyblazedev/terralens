import { clientIp, rateLimit, verifyUser, verifyAdmin } from "../_lib/guard.js";
import { clean, cleanUrl } from "../_lib/env.js";

// AI assistant, served through OpenRouter (https://openrouter.ai).
// Set OPENROUTER_API_KEY in Vercel. Optionally set OPENROUTER_MODEL (default below).
const DEFAULT_MODEL = "openai/gpt-4o-mini";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!(await rateLimit(`chat-ip:${clientIp(req)}`, 30, 60_000))) return res.status(429).json({ error: "Too many requests. Try again soon." });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: "Admins only. Sign in with your admin account." });
  const user = await verifyUser(req);
  const uid = user?.id || "admin";
  if (!(await rateLimit(`chat-min:${uid}`, 8, 60_000)) || !(await rateLimit(`chat-day:${uid}`, 60, 86_400_000))) {
    return res.status(429).json({ error: "Message limit reached. Try again later." });
  }

  const key = clean("OPENROUTER_API_KEY");
  if (!key) return res.status(500).json({ error: "The AI service is not configured." });

  const message = String(req.body?.message || "").trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": cleanUrl("SITE_URL") || `https://${req.headers.host}`,
        "X-Title": "TerraLens"
      },
      body: JSON.stringify({
        model: clean("OPENROUTER_MODEL") || DEFAULT_MODEL,
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: `You are TerraLens ADMIN AI. The user is a confirmed site admin. You know everything about this TerraLens website and can instruct admin actions step-by-step. Be concise, give exact clicks/queries, never invent live prices/hours/visa/weather - label estimates and point to official sources. Never reveal secrets or tokens. Refuse non-admin users politely (but the route already enforces admin - see below).
SITE KNOWLEDGE:
TerraLens admin knowledge (generated from repo).

SITE: TerraLens - visual place-discovery platform. Explore, collections, trips, planner, AI assistant, upload, blog, admin.

PAGES (22): 404.html, about.html, admin.html, assistant.html, collection.html, collections.html, content-policy.html, edit.html, explore.html, hub.html, index.html, login.html, logout.html, place.html, planner.html, privacy.html, profile.html, saved.html, terms.html, trips.html, upload.html, write-for-us.html

FRONTEND JS: src/js/app.js, src/js/collections.js, src/js/config.js, src/js/i18n.js, src/js/markdown.js, src/js/planner.js, src/js/runtime-config.js, src/js/site.js, src/js/supabase.js, src/js/ui.js, src/js/unsplash.js, src/js/utils.js

API ROUTES: api/_lib/env.js, api/_lib/guard.js, api/_lib/seo.js, api/ai/chat.js, api/blog.js, api/health.js, api/hub.js, api/photos/categories.js, api/photos/place.js, api/place.js, api/robots.js, api/sitemap.js, api/unsplash/categories.js, api/unsplash/download.js, api/unsplash/search.js

DATABASE TABLES (Supabase Postgres, RLS on): profiles, places, place_images, likes, saves, collections, collection_items, comments, trips, trip_places, creator_links, admins, reports, image_likes, posts, place_views

KEY TABLES:
- profiles (id uuid = auth user, username, display_name, avatar_url, bio, verified, is admin via public.admins email list + is_admin() rpc)
- places (id, slug unique, name, description, country/region/city, category, lat/lng, best_season/best_time, entry_fee/access_info, cover_url, created_by, status draft/published/hidden/pending, featured, sponsored, sponsor_name, affiliate_url, view_count)
- place_images (place_id, storage_path, image_url, alt_text, created_by) - storage bucket place-images, 10 max per place, 1h edit window for non-admins
- likes / image_likes (one per user per place/photo), saves (user_id+place_id), collections + collection_items, trips + trip_places, comments (live places only, 15/hr), reports (visitor reports, admin action), creator_links, posts (blog, admin write, published readable)
- admins table (email) - is_admin() checks confirmed email in admins. Admin-only rpc: admin_contributors

RULES:
- New places from unverified users -> pending review; verified publish instantly. Daily + pending limits stop floods.
- Revenue/moderation fields (featured/sponsored/sponsor_name/affiliate_url/view_count) admin-only, enforced by trigger protect_place_fields.
- Hidden places disappear from Explore and /place/slug 404s.
- Upload needs confirmed email. Storage path = user_id/place_id/uuid.jpg. Deleting place orphans storage files.
- Blog posts admin-write, published readable.
- AI route /api/ai/chat: POST message (max 2000 chars), needs Supabase Bearer [REDACTED] (401 without), rate-limited 8/min + 60/day, uses OpenRouter (OPENROUTER_API_KEY, OPENROUTER_MODEL default openai/gpt-4o-mini), 700 max_tokens, temp 0.4. System prompt: concise travel discovery, never invent prices/hours/visa/weather, label estimates.

ADMIN PAGE (/admin.html, noindex): gate = must be signed in + is_admin() true else "You don't have access". Sections: stats (pending/published/hidden/users/open reports), places (search/filter status, approve pending->published, hide, feature, sponsor, edit affiliate https only, delete, details, add Unsplash w/ credit, 1-tap fill photos), comments mod, reports (hide place / delete comment / dismiss), contributors verify, missing covers autofill, seed import, blog posts CRUD. Security: page gate is convenience, RLS blocks non-admins via API too.

BUILD/DEPLOY (Vercel): build = generate-config.mjs (needs SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY -> src/js/runtime-config.js, REQUIRE_LOGIN default now TRUE = sign-in wall on) + seo-build.mjs (needs SITE_URL) + tailwindcss + build-public.mjs. Env: SITE_URL, UNSPLASH_ACCESS_KEY, OPENROUTER_API_KEY/OPENROUTER_MODEL, AFFILIATE_BOOKING_AID/LABEL, UPSTASH REDIS optional. CSP allows esm.sh + supabase + fonts. Runtime-config maps SUPABASE publishable key client-side.

NAV/AUTH BUG HISTORY: initNav paints [data-auth-label] with full_name or Profile; i18n applyTranslations used to wipe it (fixed by removeAttribute data-i18n + initLang first + live repaint on onAuthStateChange). Sign-in wall: REQUIRE_LOGIN true redirects all except login/terms/privacy/content-policy to login.html?next=. If user sees Sign in while logged in: session missing (redirect URL mismatch, wrong domain alias terralens vs terralenss, SUPABASE keys missing, or stale cache). Check runtime-config.js live + Supabase Auth redirect URLs include SITE_URL/login.html.

I18N: 15 langs (en fr es pt de sw ha yo ig zh ar hi ru ko id), en source, interface only (descriptions NOT translated), ?lang= override, localStorage, RTL for ar. AI was doing translation attempts - keep AI for travel planning, not UI translation.

HOW TO DO ADMIN STUFF (via site, no SQL needed unless noted):
- approve place: admin -> Pending -> Approve (status published)
- hide: status hidden
- feature/sponsor: toggles + sponsor_name + https affiliate_url
- add photo: search Unsplash -> adds with credit, first becomes cover if missing
- verify contributor: contributors -> toggle verified (verified edits go live, unverified go pending)
- moderate comment: comments -> delete; reports -> action/dismiss
- make yourself admin (SQL once): insert into public.admins (email) values ('you@email') on conflict do nothing (need confirmed sign-in first)
- blog: posts section create/edit/delete, status published
`
          },
          { role: "user", content: message }
        ]
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("OpenRouter error", r.status, JSON.stringify(data).slice(0, 300));
      const text = r.status === 402 ? "The AI assistant is paused right now. Please try again later."
        : r.status === 429 ? "The AI assistant is busy. Please try again in a minute."
        : "The AI assistant is unavailable right now. Please try again.";
      return res.status(503).json({ error: text });
    }
    return res.status(200).json({ reply: data?.choices?.[0]?.message?.content || "I couldn't generate a response." });
  } catch {
    return res.status(502).json({ error: "Unable to reach the AI service." });
  }
}
