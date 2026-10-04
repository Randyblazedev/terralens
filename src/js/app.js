import { supabase, getUser, ensureProfile } from "./supabase.js";

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

export function card(place) {
  return `<a href="${placeUrl(place)}" class="group block overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]">
    <div class="aspect-[4/3] overflow-hidden bg-white/5">
      <img src="${escapeHtml(place.cover_url || place.image_url || "")}" alt="${escapeHtml(place.name)}" class="h-full w-full object-cover transition duration-700 group-hover:scale-105">
    </div>
    <div class="p-5">
      <div class="mb-2 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-sky-300">
        <span>${escapeHtml(place.category || "Place")}</span><span>${escapeHtml(place.country || "")}</span>
      </div>
      <h3 class="font-display text-xl font-bold">${escapeHtml(place.name)}</h3>
      <p class="mt-2 line-clamp-2 text-sm leading-6 text-white/55">${escapeHtml(place.description || "")}</p>
    </div>
  </a>`;
}

const cleanSearch = q => String(q).replace(/[,()%*_\\"'`:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

export async function queryPlaces({q="",category="",country="",limit=24}={}) {
  if (!supabase) return fallbackPlaces.filter(p => (!q || `${p.name} ${p.description} ${p.country}`.toLowerCase().includes(q.toLowerCase())) && (!category || p.category===category) && (!country || p.country===country)).slice(0,limit);
  let query = supabase.from("places").select("*").eq("status","published").order("created_at",{ascending:false}).limit(limit);
  const term = cleanSearch(q);
  if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,country.ilike.%${term}%,region.ilike.%${term}%`);
  if (category) query = query.eq("category",category);
  if (country) query = query.eq("country",country);
  const {data,error} = await query;
  if (error) return fallbackPlaces.slice(0,limit);
  return data || [];
}

export async function requireAuth(next = location.href) {
  const user = await getUser();
  if (user) return user;
  location.href = `login.html?next=${encodeURIComponent(next)}`;
}

export async function initNav() {
  const user = await getUser();
  document.querySelectorAll("[data-auth-label]").forEach(el => {
    el.textContent = user ? (user.user_metadata?.full_name || "Profile") : "Sign in";
  });
  document.querySelectorAll("[data-auth-href]").forEach(el => {
    el.href = user ? "profile.html" : `login.html?next=${encodeURIComponent(location.href)}`;
  });
  document.querySelectorAll("[data-upload-link]").forEach(el => {
    el.addEventListener("click", async e => {
      e.preventDefault();
      if (user) location.href = "upload.html";
      else location.href = `login.html?next=${encodeURIComponent("upload.html")}`;
    });
  });
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
