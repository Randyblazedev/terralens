import { supabase, getUser, ensureProfile } from "./supabase.js";
import { REQUIRE_LOGIN } from "./config.js";

export const fallbackPlaces = [
  {id:"seed-1",slug:"mount-cameroon",name:"Mount Cameroon",description:"A volcanic landscape rising above Buea with forest, cloud, and dramatic mountain views.",country:"Cameroon",region:"South-West",city:"Buea",category:"Mountain",cover_url:"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=85"},
  {id:"seed-2",slug:"lobe-waterfalls",name:"Lobé Waterfalls",description:"A striking coastal waterfall where fresh water meets the Atlantic near Kribi.",country:"Cameroon",region:"South",city:"Kribi",category:"Waterfall",cover_url:"https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=1600&q=85"},
  {id:"seed-3",slug:"lake-bled",name:"Lake Bled",description:"An alpine lake framed by mountains, an island church, and a historic cliffside castle.",country:"Slovenia",region:"Upper Carniola",city:"Bled",category:"Lake",cover_url:"https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1600&q=85"},
  {id:"seed-4",slug:"banff-national-park",name:"Banff National Park",description:"Turquoise lakes, dramatic peaks, and huge wilderness landscapes in the Canadian Rockies.",country:"Canada",region:"Alberta",city:"Banff",category:"National Park",cover_url:"https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=85"}
];

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

export function card(place) {
  const url = placeUrl(place);
  const name = place.author ? (place.author.display_name || place.author.username || "") : "";
  const by = name ? `<span class="flex min-w-0 items-center gap-1.5 text-xs text-white/55"><span class="truncate">${escapeHtml(name)}</span>${place.author.verified ? verifiedBadge(15) : ""}</span>` : "<span></span>";
  return `<article class="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]">
    <a href="${url}" class="block aspect-[4/3] overflow-hidden bg-white/5" tabindex="-1" aria-hidden="true">
      <img src="${escapeHtml(place.cover_url || place.image_url || "")}" alt="" loading="lazy" class="h-full w-full object-cover transition duration-700 group-hover:scale-105">
    </a>
    <div class="p-5">
      <div class="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-sky-300">
        <span>${escapeHtml(place.category || "Place")}</span><span>${escapeHtml(place.country || "")}</span>
      </div>
      <h3 class="font-display text-xl font-bold"><a href="${url}">${escapeHtml(place.name)}</a></h3>
      <p class="mt-2 line-clamp-2 text-sm leading-6 text-white/55">${escapeHtml(place.description || "")}</p>
      <div class="mt-4 flex items-center justify-between gap-3">${by}<a href="${url}" class="tl-btn tl-btn-ghost !min-h-9 shrink-0 !px-4" aria-label="View ${escapeHtml(place.name)}">View</a></div>
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
    el.textContent = user ? (user.user_metadata?.full_name || "Profile") : "Sign in";
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
  document.querySelectorAll("header nav").forEach(n => n.insertAdjacentHTML("beforeend", '<a class="hover:text-white" href="saved.html">Saved</a>'));
  document.querySelectorAll("[data-mobile-nav] .grid").forEach(n => n.insertAdjacentHTML("beforeend", '<a class="rounded-xl px-4 py-3 hover:bg-white/5" href="saved.html">Saved places</a>'));
  if (user) {
    document.querySelectorAll("header nav").forEach(n => n.insertAdjacentHTML("beforeend", '<a class="hover:text-white" href="logout.html">Sign out</a>'));
    document.querySelectorAll("[data-mobile-nav] .grid").forEach(n => n.insertAdjacentHTML("beforeend", '<a class="rounded-xl px-4 py-3 hover:bg-white/5" href="logout.html">Sign out</a>'));
  }
  if (user && supabase) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin === true) {
      document.querySelectorAll("header nav").forEach(n => n.insertAdjacentHTML("beforeend", '<a class="hover:text-white" href="admin.html">Admin</a>'));
      document.querySelectorAll("[data-mobile-nav] .grid").forEach(n => n.insertAdjacentHTML("beforeend", '<a class="rounded-xl px-4 py-3 hover:bg-white/5" href="admin.html">Admin</a>'));
    }
  }
  document.querySelectorAll("[data-menu]").forEach(btn => {
    btn.addEventListener("click", () => document.querySelector("[data-mobile-nav]")?.classList.toggle("hidden"));
  });
}

if (supabase) {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) await ensureProfile(session.user);
  });
}
