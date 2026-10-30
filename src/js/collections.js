import { supabase, getUser } from "./supabase.js";
import { escapeHtml } from "./app.js";
import { toast } from "./ui.js";

// Collections and trips both had tables, policies and read paths but no write path at all:
// nothing in the site could ever put a place into a collection or a trip. These helpers are
// that missing layer, used by the place page and the planner.

const requireUser = async () => {
  const user = await getUser();
  if (!user) return null;
  return user;
};

export async function listCollections(userId) {
  if (!supabase || !userId) return [];
  const { data } = await supabase.from("collections")
    .select("id,name,is_public,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function createCollection(userId, name, isPublic = true) {
  if (!supabase || !userId) return { error: "offline" };
  const clean = String(name || "").trim().slice(0, 80);
  if (!clean) return { error: "empty" };
  const { data, error } = await supabase.from("collections")
    .insert({ user_id: userId, name: clean, description: "", is_public: !!isPublic })
    .select("id,name,is_public,created_at")
    .single();
  return error ? { error } : { collection: data };
}

export async function setCollectionVisibility(collectionId, isPublic) {
  if (!supabase) return { error: "offline" };
  const { error } = await supabase.from("collections")
    .update({ is_public: !!isPublic, updated_at: new Date().toISOString() })
    .eq("id", collectionId);
  return error ? { error } : { ok: true };
}

export async function collectionHasPlace(collectionId, placeId) {
  if (!supabase) return false;
  const { data } = await supabase.from("collection_items")
    .select("place_id").eq("collection_id", collectionId).eq("place_id", placeId).maybeSingle();
  return !!data;
}

export async function addPlaceToCollection(collectionId, placeId) {
  if (!supabase) return { error: "offline" };
  const { error } = await supabase.from("collection_items")
    .upsert({ collection_id: collectionId, place_id: placeId }, { onConflict: "collection_id,place_id" });
  return error ? { error } : { ok: true };
}

export async function removePlaceFromCollection(collectionId, placeId) {
  if (!supabase) return { error: "offline" };
  const { error } = await supabase.from("collection_items")
    .delete().eq("collection_id", collectionId).eq("place_id", placeId);
  return error ? { error } : { ok: true };
}

export async function listTrips(userId) {
  if (!supabase || !userId) return [];
  const { data } = await supabase.from("trips")
    .select("id,name,start_date,end_date")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function createTrip(userId, { name, start = null, end = null, budget = null, description = null }) {
  if (!supabase || !userId) return { error: "offline" };
  const clean = String(name || "").trim().slice(0, 80);
  if (!clean) return { error: "empty" };
  const { data, error } = await supabase.from("trips")
    .insert({
      user_id: userId,
      name: clean,
      description: description ? String(description).slice(0, 500) : null,
      start_date: start || null,
      end_date: end || null,
      budget: budget ? String(budget).slice(0, 80) : null
    })
    .select("id,name,start_date,end_date")
    .single();
  return error ? { error } : { trip: data };
}

export async function addPlaceToTrip(tripId, placeId, dayNumber = 1) {
  if (!supabase) return { error: "offline" };
  const { error } = await supabase.from("trip_places")
    .upsert({ trip_id: tripId, place_id: placeId, day_number: Math.max(1, Number(dayNumber) || 1), position: 0 },
      { onConflict: "trip_id,place_id" });
  return error ? { error } : { ok: true };
}

export async function tripPlaces(tripId) {
  if (!supabase) return [];
  const { data } = await supabase.from("trip_places")
    .select("day_number,position,places(*)")
    .eq("trip_id", tripId)
    .order("day_number").order("position");
  return (data || []).map(r => ({ ...r.places, day_number: r.day_number })).filter(p => p && p.id);
}

export async function saveTripPlaces(tripId, places) {
  if (!supabase || !tripId) return { error: "offline" };
  await supabase.from("trip_places").delete().eq("trip_id", tripId);
  if (!places.length) return { ok: true };
  const rows = places.map((p, i) => ({
    trip_id: tripId,
    place_id: p.id,
    day_number: Math.max(1, Number(p.day_number) || 1),
    position: i
  }));
  const { error } = await supabase.from("trip_places").upsert(rows, { onConflict: "trip_id,place_id" });
  return error ? { error } : { ok: true };
}

/* ------------------------------------------------------------------ */
/* Picker dialog: the UI that was completely missing                   */
/* ------------------------------------------------------------------ */

function openPicker({ title, subtitle, items, emptyText, onCreate, onPick, createLabel }) {
  return new Promise(resolve => {
    const previous = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center";
    const render = list => list.map(i => `
      <button type="button" data-pick="${escapeHtml(i.id)}"
        class="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-left text-sm hover:bg-white/[.09]">
        <span class="min-w-0">
          <span class="block truncate font-bold">${escapeHtml(i.name)}</span>
          <span class="mt-0.5 block truncate text-xs text-white/45">${escapeHtml(i.meta || "")}</span>
        </span>
        <span class="shrink-0 text-sky-300">${i.action || "Add"}</span>
      </button>`).join("");

    overlay.innerHTML = `<div role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"
      class="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1220] p-6 shadow-2xl">
      <h2 class="text-xl font-extrabold">${escapeHtml(title)}</h2>
      ${subtitle ? `<p class="mt-1 text-sm text-white/50">${escapeHtml(subtitle)}</p>` : ""}
      <div data-list class="mt-5 grid max-h-[45vh] gap-2 overflow-y-auto">
        ${items.length ? render(items) : `<p class="text-sm text-white/45">${escapeHtml(emptyText || "Nothing here yet.")}</p>`}
      </div>
      <div class="mt-5 grid gap-2">
        <div class="flex gap-2">
          <input data-new class="tl-input" maxlength="80" placeholder="${escapeHtml(createLabel || "New name")}" aria-label="${escapeHtml(createLabel || "New name")}">
          <button type="button" data-create class="tl-btn tl-btn-primary shrink-0">Create</button>
        </div>
        <button type="button" data-close class="tl-btn tl-btn-ghost">Close</button>
      </div>
    </div>`;
    document.body.append(overlay);
    document.documentElement.style.overflow = "hidden";

    const finish = value => {
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.style.overflow = "";
      overlay.remove();
      previous?.focus?.();
      resolve(value);
    };
    const onKey = e => { if (e.key === "Escape") { e.preventDefault(); finish(null); } };
    document.addEventListener("keydown", onKey, true);

    const setItems = list => {
      const host = overlay.querySelector("[data-list]");
      host.innerHTML = list.length ? render(list) : `<p class="text-sm text-white/45">${escapeHtml(emptyText || "Nothing here yet.")}</p>`;
    };

    overlay.addEventListener("click", async e => {
      if (e.target === overlay) { finish(null); return; }
      const pick = e.target.closest("[data-pick]");
      if (pick) { finish({ id: pick.dataset.pick }); return; }
      if (e.target.closest("[data-close]")) { finish(null); return; }
      if (e.target.closest("[data-create]")) {
        const input = overlay.querySelector("[data-new]");
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        const btn = e.target.closest("[data-create]");
        btn.disabled = true;
        const made = await onCreate(name);
        btn.disabled = false;
        if (made?.error) { toast("Couldn't create that. Please try again.", "error"); return; }
        input.value = "";
        if (made?.item) {
          const current = items.some(i => i.id === made.item.id) ? items : [...items, made.item];
          items = current;
          setItems(items);
          finish({ id: made.item.id });
        }
      }
    });
    (overlay.querySelector("[data-new]") || overlay.querySelector("[data-close]")).focus();
  });
}

// Opens the collection picker for one place. Creates a collection if the visitor has none.
export async function pickCollectionForPlace(place) {
  const user = await requireUser();
  if (!user) return null;
  const rows = await listCollections(user.id);
  const chosen = await openPicker({
    title: "Save to a collection",
    subtitle: place?.name ? `Adding ${place.name}` : null,
    items: rows.map(c => ({ id: c.id, name: c.name, meta: c.is_public ? "Public" : "Private" })),
    emptyText: "You have no collections yet. Create one below.",
    createLabel: "New collection name",
    onCreate: async name => {
      const r = await createCollection(user.id, name, true);
      return r.error ? r : { item: { id: r.collection.id, name: r.collection.name, meta: "Public" } };
    }
  });
  if (!chosen?.id || !place?.id) return null;
  const already = await collectionHasPlace(chosen.id, place.id);
  if (already) { toast("That place is already in this collection.", "info"); return chosen.id; }
  const r = await addPlaceToCollection(chosen.id, place.id);
  toast(r.error ? "Couldn't add it to that collection. Please try again." : "Added to your collection.", r.error ? "error" : "success");
  return r.error ? null : chosen.id;
}

// Opens the trip picker for one place. Creates a trip if the visitor has none.
export async function pickTripForPlace(place) {
  const user = await requireUser();
  if (!user) return null;
  const rows = await listTrips(user.id);
  const chosen = await openPicker({
    title: "Add to a trip",
    subtitle: place?.name ? `Adding ${place.name}` : null,
    items: rows.map(t => ({
      id: t.id,
      name: t.name,
      meta: [t.start_date, t.end_date].filter(Boolean).join(" to ") || "No dates set"
    })),
    emptyText: "You have no trips yet. Create one below.",
    createLabel: "New trip name",
    onCreate: async name => {
      const r = await createTrip(user.id, { name });
      return r.error ? r : { item: { id: r.trip.id, name: r.trip.name, meta: "No dates set" } };
    }
  });
  if (!chosen?.id || !place?.id) return null;
  const r = await addPlaceToTrip(chosen.id, place.id);
  toast(r.error ? "Couldn't add it to that trip. Please try again." : "Added to your trip.", r.error ? "error" : "success");
  return r.error ? null : chosen.id;
}
