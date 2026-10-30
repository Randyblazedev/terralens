import { supabase, getUser, ensureProfile } from "./supabase.js";
import { initLang, currentLang, setLang, LANGUAGES, t } from "./i18n.js";
import { REQUIRE_LOGIN } from "./config.js";

export const fallbackPlaces = [
  {id:"seed-1",slug:"mount-cameroon",name:"Mount Cameroon",description:"A volcanic landscape rising above Buea with forest, cloud, and dramatic mountain views.",country:"Cameroon",region:"South-West",city:"Buea",category:"Mountain",cover_url:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=85"},
  {id:"seed-2",slug:"lobe-waterfalls",name:"Lobé Waterfalls",description:"A striking coastal waterfall where fresh water meets the Atlantic near Kribi.",country:"Cameroon",region:"South",city:"Kribi",category:"Waterfall",cover_url:"https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=1600&q=85"},
  {id:"seed-3",slug:"lake-bled",name:"Lake Bled",description:"An alpine lake framed by mountains, an island church, and a historic cliffside castle.",country:"Slovenia",region:"Upper Carniola",city:"Bled",category:"Lake",cover_url:"https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1600&q=85"},
  {id:"seed-4",slug:"banff-national-park",name:"Banff National Park",description:"Turquoise lakes, dramatic peaks, and huge wilderness landscapes in the Canadian Rockies.",country:"Canada",region:"Alberta",city:"Banff",category:"National Park",cover_url:"https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=85"}
];

// The footer year is written by script so it can never be a future date again.
export function stampYear(root = document) {
  const y = String(new Date().getFullYear());
  root.querySelectorAll("[data-year]").forEach(el => { el.textContent = y; });
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => stampYear());
  else stampYear();
}

// Builds a Booking.com search link for a place's own town and country. Returns "" when no
// affiliate id is configured, so the earning button simply does not appear.
export function stayLink(place, aid) {
  const id = String(aid || "").trim();
  if (!id || !place) return "";
  const where = [place.city, place.region, place.country].filter(Boolean).join(", ");
  if (!where) return "";
  const params = new URLSearchParams({ ss: where, aid: id });
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

export function escapeHtml(value="") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

export function slugify(value="") {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

export function placeUrl(place) {
  return `place/${encodeURIComponent(place.slug || place.id)}`;
}

// Looks up the uploader (name + verified flag) for a list of places in one request.
export async function attachAuthors(places) {
  if (!supabase || !places?.length) return places;
  const ids = [...new Set(places.map(p => p.created_by).filter(Boolean))];
  if (!ids.length) return places;
  const { data } = await supabase.from("profiles").select("id,display_name,username,verified").in("id", ids);
  const byId = Object.fromEntries((data || []).map(a => [a.id, a]));
  places.forEach(p => { p.author = byId[p.created_by] || null; });
  return places;
}

// Unsplash images can be resized by adding width and quality to the address (other hosts are left alone).
export function imgSize(url, w, q = 75) {
  try {
    const u = new URL(url);
    if (u.hostname !== "images.unsplash.com") return url;
    u.searchParams.set("w", String(w)); u.searchParams.set("q", String(q)); u.searchParams.set("auto", "format"); u.searchParams.set("fit", "max");
    return u.toString();
  } catch { return url; }
}

// 1234 -> "1.2K", 2500000 -> "2.5M"
export function formatCount(n) {
  n = Math.max(0, Number(n) || 0);
  if (n < 1000) return String(n);
  if (n < 1e6) {
    const k = n < 10000 ? Math.round(n / 100) / 10 : Math.round(n / 1000);
    if (k < 1000) return String(k).replace(/\.0$/, "") + "K";
  }
  const m = n < 1e7 ? Math.round(n / 1e5) / 10 : Math.round(n / 1e6);
  return String(m).replace(/\.0$/, "") + "M";
}
export const EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;
// A zero count is a negative signal, so nothing is shown until a place has been viewed.
export const viewsBadge = n => (Number(n) || 0) > 0 ? `<span class="inline-flex items-center gap-1 text-xs text-white/45" aria-label="${Number(n)} views" title="${Number(n)} views">${EYE}${formatCount(n)}</span>` : "";

// "Other" is the database default, not a real category, so it is never shown to a visitor.
const isRealCategory = c => !!c && String(c).trim() !== "" && String(c).toLowerCase() !== "other";
export const categoryLabel = place => isRealCategory(place.category) ? String(place.category) : "";

// Real places have a uuid id; the offline fallback places do not, and cannot be saved.
const canSave = place => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(place.id || ""));
const HEART = on => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;

const saveButton = place => canSave(place)
  ? `<button type="button" data-save="${escapeHtml(place.id)}" aria-pressed="false" aria-label="Save ${escapeHtml(place.name)}" title="Save this place" class="tl-save-btn inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-white/35 hover:text-white">${HEART(false)}</button>`
  : "";

// Loads the visitor's saved places once, paints every save button, and handles toggling.
export async function initCardSaves(root = document) {
  const buttons = [...root.querySelectorAll("[data-save]")];
  if (!buttons.length || !supabase) return;
  const user = await getUser();
  if (user) {
    const { data } = await supabase.from("saves").select("place_id").eq("user_id", user.id);
    const saved = new Set((data || []).map(r => r.place_id));
    buttons.forEach(b => {
      const on = saved.has(b.dataset.save);
      b.setAttribute("aria-pressed", String(on));
      b.innerHTML = HEART(on);
    });
  }
  buttons.forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", async e => {
      e.preventDefault(); e.stopPropagation();
      const current = await getUser();
      if (!current) { location.href = `login.html?next=${encodeURIComponent(location.href)}`; return; }
      const on = btn.getAttribute("aria-pressed") === "true";
      btn.disabled = true;
      const r = on
        ? await supabase.from("saves").delete().eq("user_id", current.id).eq("place_id", btn.dataset.save)
        : await supabase.from("saves").upsert({ user_id: current.id, place_id: btn.dataset.save });
      btn.disabled = false;
      if (r.error) return;
      btn.setAttribute("aria-pressed", String(!on));
      btn.innerHTML = HEART(!on);
      btn.setAttribute("title", !on ? "Saved" : "Save this place");
    });
  });
}

export function card(place) {
  const url = placeUrl(place);
  const name = place.author ? (place.author.display_name || place.author.username || "") : "";
  const by = name ? `<span class="flex min-w-0 items-center gap-1.5 text-xs text-white/55"><span class="truncate">${escapeHtml(name)}</span>${place.author.verified ? verifiedBadge(15) : ""}</span>` : "<span></span>";
  return `<article class="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]">
    <a href="${url}" class="block aspect-[4/3] overflow-hidden bg-white/5" tabindex="-1" aria-hidden="true">
      <img src="${escapeHtml(imgSize(place.cover_url || place.image_url || "", 640))}" srcset="${escapeHtml(imgSize(place.cover_url || place.image_url || "", 480))} 480w, ${escapeHtml(imgSize(place.cover_url || place.image_url || "", 800))} 800w" sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw" alt="${escapeHtml(place.name)}${place.country ? ", " + escapeHtml(place.country) : ""}" loading="lazy" decoding="async" class="h-full w-full object-cover transition duration-700 group-hover:scale-105">
    </a>
    <div class="p-5">
      <div class="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-sky-300">
        <span>${escapeHtml(categoryLabel(place))}</span><span class="text-white/40">${escapeHtml(place.country || "")}</span>
      </div>
      <h3 class="font-display text-xl font-bold"><a href="${url}">${escapeHtml(place.name)}</a></h3>
      <p class="mt-2 line-clamp-2 text-sm leading-6 text-white/55">${escapeHtml(place.description || "")}</p>
      <div class="mt-4 flex items-center justify-between gap-3">${by}<div class="flex shrink-0 items-center gap-3">${viewsBadge(place.view_count)}${saveButton(place)}<a href="${url}" class="tl-btn tl-btn-ghost !min-h-9 shrink-0 !px-4" aria-label="View ${escapeHtml(place.name)}">View</a></div></div>
    </div>
  </article>`;
}

const cleanSearch = q => String(q).replace(/[,()%*_\\"'`:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

export async function queryPlaces({q="",category="",country="",limit=24,offset=0}={}) {
  if (!supabase) return fallbackPlaces.filter(p => (!q || `${p.name} ${p.description} ${p.country}`.toLowerCase().includes(q.toLowerCase())) && (!category || p.category===category) && (!country || p.country===country)).slice(offset,offset+limit);
  let query = supabase.from("places").select("*").eq("status","published").order("created_at",{ascending:false}).range(offset, offset + limit - 1);
  const term = cleanSearch(q);
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,country.ilike.%${term}%,region.ilike.%${term}%`);
  if (category) query = query.eq("category",category);
  if (country) query = query.eq("country",country);
  const {data,error} = await query;
  if (error) return fallbackPlaces.slice(offset,offset+limit);
  return attachAuthors(data || []);
}

// The homepage grid: a mix of categories instead of whatever was uploaded last, with "Other"
// and very short descriptions kept out, so the first thing a visitor sees is always finished.
export async function queryFeatured(limit = 8) {
  const MIN_DESCRIPTION = 60;
  const good = p => isRealCategory(p.category) && String(p.description || "").trim().length >= MIN_DESCRIPTION && p.cover_url;
  if (!supabase) return fallbackPlaces.slice(0, limit);

  const { data, error } = await supabase.from("places")
    .select("*").eq("status", "published")
    .order("featured", { ascending: false })
    .order("view_count", { ascending: false })
    .limit(120);
  if (error) return fallbackPlaces.slice(0, limit);

  const pool = await attachAuthors((data || []).filter(good));
  const picked = [], perCategory = new Map();
  // First pass: one per category, so the grid shows range.
  for (const p of pool) {
    if (picked.length >= limit) break;
    if ((perCategory.get(p.category) || 0) > 0) continue;
    perCategory.set(p.category, 1);
    picked.push(p);
  }
  // Second pass: fill any remaining slots with the next best, allowing a second per category.
  for (const p of pool) {
    if (picked.length >= limit) break;
    if (picked.includes(p)) continue;
    if ((perCategory.get(p.category) || 0) >= 2) continue;
    perCategory.set(p.category, (perCategory.get(p.category) || 0) + 1);
    picked.push(p);
  }
  return picked;
}

export async function requireAuth(next = location.href) {
  const user = await getUser();
  if (user) return user;
  location.href = `login.html?next=${encodeURIComponent(next)}`;
}

// Lucide "badge-check" icon (ISC licence) filled gold, for verified contributors.
export function verifiedBadge(size = 18) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" role="img" aria-label="Verified contributor" class="inline-block shrink-0 align-[-0.2em]" fill="#F5B301" stroke="#F5B301" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>Verified contributor</title><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12" stroke="#fff"/></svg>`;
}

// Uploaders can edit a place for one hour after uploading it (the database enforces this too).
export const EDIT_WINDOW_MS = 60 * 60 * 1000;
export const editMinutesLeft = place => Math.max(0, Math.ceil((new Date(place.created_at).getTime() + EDIT_WINDOW_MS - Date.now()) / 60000));
export const canEdit = place => editMinutesLeft(place) > 0;

// Back arrow (Lucide "arrow-left"). The link always works (it goes to the fallback page); when the visitor
// came from another TerraLens page it goes back one step instead, so filters and scroll position are kept.
const ARROW = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;
export function backLink(fallback = "explore.html", label = "Back") {
  return `<a href="${fallback}" data-back class="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-4 text-sm font-bold text-white/80 hover:bg-white/10">${ARROW}${label}</a>`;
}
export function backFab(fallback = "explore.html") {
  return `<a href="${fallback}" data-back aria-label="Back" class="fixed bottom-5 left-4 z-40 grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-[#0b1220]/90 text-white shadow-xl backdrop-blur">${ARROW}</a>`;
}

// Adds a Back button to every page that does not already have one (the home page has nothing to go back to).
// Long reading pages also get the round arrow that stays in the corner while you scroll.
const OWN_BACK = new Set(["index", "place", "edit", "collection", "login", "logout"]);
const READING_PAGES = new Set(["terms", "privacy", "content-policy", "about"]);
export function injectBack(doc = document, path = location.pathname) {
  const name = path.startsWith("/place/") ? "place" : ((path.split("/").pop() || "index").replace(/\.html$/, "") || "index");
  if (OWN_BACK.has(name) || doc.querySelector("[data-back]")) return name;
  const main = doc.querySelector("main");
  if (!main) return name;
  (main.querySelector(".tl-shell") || main).insertAdjacentHTML("afterbegin", `<div class="mb-6">${backLink("index.html")}</div>`);
  if (READING_PAGES.has(name)) doc.body.insertAdjacentHTML("beforeend", backFab("index.html"));
  return name;
}

export async function initNav() {
  initLang();
  injectBack();
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-back]");
    if (!b || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    let same = false;
    try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch {}
    if (same && history.length > 1) { e.preventDefault(); history.back(); }
  });
  // Sign-in wall: everything except the login, terms and privacy pages needs an account.
  const open = /\/(login|terms|privacy|content-policy)(\.html)?$/.test(location.pathname);
  if (REQUIRE_LOGIN && supabase && !open) {
    document.documentElement.style.visibility = "hidden";
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      location.replace("login.html?next=" + encodeURIComponent(location.pathname.replace(/^\//, "") + location.search));
      return;
    }
    document.documentElement.style.visibility = "";
  }
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const user = session?.user || null;
  document.querySelectorAll("[data-auth-label]").forEach(el => {
    el.textContent = user ? (user.user_metadata?.full_name || "Profile") : t("auth.signIn");
    el.removeAttribute("data-i18n");
  });
  document.querySelectorAll("[data-auth-href]").forEach(el => {
    el.href = user ? "profile.html" : `login.html?next=${encodeURIComponent(location.href)}`;
    el.classList.add("tl-ready");
  });
  document.querySelectorAll("[data-upload-link]").forEach(el => {
    el.addEventListener("click", async e => {
      e.preventDefault();
      if (user) location.href = "upload.html";
      else location.href = `login.html?next=${encodeURIComponent("upload.html")}`;
    });
  });
  // Language switcher: injected after the nav exists, in both desktop and mobile ends.
  const current = currentLang();

  const picker = `<details class="tl-lang relative"><summary class="hover:text-white cursor-pointer list-none flex items-center gap-1" data-i18n-aria="nav.language" aria-label="Language">🌐 <span data-i18n="nav.language">${t("nav.language")}</span></summary><div class="tl-lang-menu absolute right-0 z-50 mt-2 min-h-11 w-44 max-h-72 overflow-auto rounded-xl border border-white/10 bg-[#0b1220] p-1 shadow-2xl">` +
    LANGUAGES.map(l => `<button type="button" data-lang="${l.code}" class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${l.code === current ? "font-bold text-sky-300" : "text-white/80"}"><span>${l.native}</span>${l.code === current ? "<span>✓</span>" : ""}</button>`).join("") +
    `</div></details>`;
  document.querySelectorAll("header nav").forEach(n => n.insertAdjacentHTML("beforeend", picker));
  document.querySelectorAll("[data-mobile-nav] .grid").forEach(n => n.insertAdjacentHTML("beforeend", `<div class="px-4 py-3"><p class="text-xs uppercase tracking-wider text-white/40 mb-2" data-i18n="nav.language">${t("nav.language")}</p><div class="flex flex-wrap gap-2">` +
    LANGUAGES.map(l => `<button type="button" data-lang="${l.code}" class="rounded-lg border px-3 py-2 text-sm ${l.code === current ? "border-sky-300/60 text-sky-300 font-bold" : "border-white/10 text-white/80"}">${l.native}</button>`).join("") +
    `</div></div>`));
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    e.preventDefault();
    const code = b.getAttribute("data-lang");
    if (code === currentLang()) return;
    setLang(code);
    location.reload();
    document.querySelectorAll("details.tl-lang").forEach(d => d.removeAttribute("open"));
    try {
      const u = new URL(location.href);
      u.searchParams.set("lang", b.getAttribute("data-lang"));
      history.replaceState(null, "", u.toString());
    } catch (_) {}
  });
  document.querySelectorAll("header nav").forEach(n => n.insertAdjacentHTML("beforeend", `<a class="hover:text-white" href="saved.html" data-i18n="nav.saved">${t("nav.saved")}</a>`));
  document.querySelectorAll("[data-mobile-nav] .grid").forEach(n => n.insertAdjacentHTML("beforeend", `<a class="rounded-xl px-4 py-3 hover:bg-white/5" href="saved.html" data-i18n="nav.saved">${t("nav.saved")}</a>`));
  if (user) {
    document.querySelectorAll("header nav").forEach(n => n.insertAdjacentHTML("beforeend", `<a class="hover:text-white" href="logout.html" data-i18n="auth.signOut">${t("auth.signOut")}</a>`));
    document.querySelectorAll("[data-mobile-nav] .grid").forEach(n => n.insertAdjacentHTML("beforeend", `<a class="rounded-xl px-4 py-3 hover:bg-white/5" href="logout.html" data-i18n="auth.signOut">${t("auth.signOut")}</a>`));
  }
  if (user && supabase) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin === true) {
      document.querySelectorAll("header nav").forEach(n => n.insertAdjacentHTML("beforeend", `<a class="hover:text-white" href="admin.html" data-i18n="nav.admin">${t("nav.admin")}</a>`));
      document.querySelectorAll("[data-mobile-nav] .grid").forEach(n => n.insertAdjacentHTML("beforeend", `<a class="rounded-xl px-4 py-3 hover:bg-white/5" href="admin.html" data-i18n="nav.admin">${t("nav.admin")}</a>`));
    }
  }
  document.querySelectorAll("[data-menu]").forEach(btn => {
    btn.addEventListener("click", () => document.querySelector("[data-mobile-nav]")?.classList.toggle("hidden"));
  });
}

if (supabase) {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await ensureProfile(session.user);
      document.querySelectorAll("[data-auth-label]").forEach(el => {
        el.textContent = session.user.user_metadata?.full_name || "Profile";
        el.removeAttribute("data-i18n");
      });
      document.querySelectorAll("[data-auth-href]").forEach(el => {
        el.href = "profile.html";
      });
    }
  });
}
