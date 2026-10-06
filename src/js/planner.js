// Trip plan builder: pure functions (no network, no page access), so they are easy to test.
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const M = MONTHS.join("|");
const RANGE = new RegExp(`(?:early|late|mid)?[\\s-]*(${M})(?:\\s*(?:to|through|until|-|–)\\s*(?:(?:early|late|mid)[\\s-]+)?(${M}))?`, "g");

// "June to September", "December to February (dry season)" -> set of month numbers (0 = January).
export function monthsIn(text) {
  const out = new Set();
  const t = String(text || "").toLowerCase();
  let m;
  RANGE.lastIndex = 0;
  while ((m = RANGE.exec(t))) {
    const a = MONTHS.indexOf(m[1]);
    if (m[2]) {
      const b = MONTHS.indexOf(m[2]);
      for (let i = a; ; i = (i + 1) % 12) { out.add(i); if (i === b) break; }
    } else out.add(a);
  }
  return out;
}

export function haversineKm(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const hasCoords = p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) && p.latitude !== null && p.longitude !== null;

// Nearest-neighbour order so places that are close together land on the same day.
export function orderPlaces(places) {
  const withGeo = places.filter(hasCoords).map(p => ({ ...p, latitude: Number(p.latitude), longitude: Number(p.longitude) }));
  const without = places.filter(p => !hasCoords(p));
  if (!withGeo.length) return [...without];
  const left = [...withGeo].sort((a, b) => a.longitude - b.longitude);
  const route = [left.shift()];
  while (left.length) {
    const last = route[route.length - 1];
    let best = 0, bestD = Infinity;
    left.forEach((p, i) => { const d = haversineKm(last, p); if (d < bestD) { bestD = d; best = i; } });
    route.push(left.splice(best, 1)[0]);
  }
  return [...route, ...without];
}

export function travelText(prev, next) {
  if (!prev || !hasCoords(prev) || !hasCoords(next)) return null;
  const km = Math.round(haversineKm({ latitude: Number(prev.latitude), longitude: Number(prev.longitude) }, { latitude: Number(next.latitude), longitude: Number(next.longitude) }));
  const border = prev.country && next.country && prev.country !== next.country ? " This crosses into another country, so check entry rules." : "";
  if (km < 5) return { km, text: `Very close to ${prev.name} (under 5 km).` };
  if (km <= 150) return { km, text: `About ${km} km from ${prev.name}, roughly ${Math.max(1, Math.round(km / 50))} h by road.${border}` };
  if (km <= 600) return { km, text: `About ${km} km from ${prev.name}: a long journey of roughly ${Math.round(km / 60)} h by road, so allow most of a day.${border}` };
  return { km, text: `About ${km} km from ${prev.name}: far apart, so consider a flight.${border}` };
}

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const addDays = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000);
const label = d => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function buildPlan({ places, start = "", end = "", budget = "", notes = "" }) {
  const list = orderPlaces(places || []);
  const n = list.length, tips = [];
  if (!n) return { days: [], tips: [], daysCount: 0 };

  let daysCount;
  if (isDate(start) && isDate(end) && end >= start) daysCount = Math.min(14, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1);
  else daysCount = Math.min(14, Math.max(1, Math.ceil(n / 2)));
  const needed = Math.min(14, Math.ceil(n / 3));
  if (daysCount < needed) {
    tips.push(`${n} places in ${daysCount} day${daysCount === 1 ? "" : "s"} would be rushed, so this plan uses ${needed} days.`);
    daysCount = needed;
  }

  const base = Math.floor(n / daysCount), extra = n % daysCount;
  const tripMonths = new Set();
  if (isDate(start)) for (let i = 0; i < Math.min(daysCount, 60); i++) tripMonths.add(addDays(start, i).getUTCMonth());

  const days = [];
  let idx = 0;
  for (let d = 0; d < daysCount; d++) {
    const size = base + (d < extra ? 1 : 0), items = [];
    for (let k = 0; k < size; k++, idx++) {
      const place = list[idx], t = travelText(list[idx - 1], place);
      const season = monthsIn(place.best_season);
      const outside = tripMonths.size && season.size && ![...tripMonths].some(m => season.has(m));
      items.push({ place, travel: t?.text || null, km: t?.km || 0, warning: outside ? `Your dates fall outside the best season (${place.best_season}).` : null });
    }
    days.push({ n: d + 1, date: isDate(start) ? label(addDays(start, d)) : "", items });
  }

  const countries = [...new Set(list.map(p => p.country).filter(Boolean))];
  if (countries.length > 1) tips.push(`This trip crosses ${countries.length} countries (${countries.join(", ")}). Check visa, border and currency rules for each.`);
  const b = String(budget || "").trim();
  if (b) {
    if (/low|cheap|tight|backpack|small/i.test(b)) tips.push(`Budget: ${b}. Favour free places, shared transport and early starts to save on tours. Entry fees are listed under each place.`);
    else if (/high|luxur|flexible|big/i.test(b)) tips.push(`Budget: ${b}. Guided tours and private transport can save time between distant places.`);
    else tips.push(`Budget: ${b}. Entry fees are listed under each place; confirm them before you go.`);
  }
  if (String(notes || "").trim()) tips.push(`Your preferences: ${String(notes).trim()}`);
  if (days.some(d => d.items.some(i => i.warning))) tips.push("Some places are outside their best season on your dates. They can still be worth visiting, but check conditions first.");
  return { days, tips, daysCount };
}

// A compact text version, used as context when you ask TerraLens AI to improve the plan.
export function planToText(name, plan) {
  return plan.days.map(d => `Day ${d.n}: ${d.items.map(i => i.place.name + (i.place.country ? ` (${i.place.country})` : "")).join(", ")}`).join("\n");
}
