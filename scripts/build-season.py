#!/usr/bin/env python3
"""Derive a best-season window for every place from its latitude and type.

This is honest reasoning, not local knowledge. Latitude gives the hemisphere and the
climate band; the place type decides what actually matters (dry weather for a beach,
strong flow for a waterfall, clear skies for a mountain). The output says what it is:
a general guide from the climate, with a line telling the reader to confirm locally.

Nothing here is scraped or guessed from a blog. It is arithmetic on the coordinates
already in the seed file.

Output: assets/place-season.json -> { "<slug>": "Dry season, roughly November to March", ... }

Usage: python3 scripts/build-season.py
"""

import json

# Climate bands by absolute latitude.
TROPICAL = 23.5
SUBTROPICAL = 35.0
TEMPERATE = 55.0

# What each kind of place needs from the weather.
NEED = {
    "Waterfall": "flow",
    "Mountain": "clear",
    "Lake": "calm",
    "Beach": "dry",
    "Forest": "dry",
}


def band(lat):
    a = abs(lat)
    if a <= TROPICAL:
        return "tropical"
    if a <= SUBTROPICAL:
        return "subtropical"
    if a <= TEMPERATE:
        return "temperate"
    return "cold"


def season(lat, category):
    south = lat < 0
    b = band(lat)
    need = NEED.get(category, "dry")

    if b == "tropical":
        # One wet season, one dry season. Dry is easier to travel; waterfalls want the
        # end of the wet season when the flow is still strong but the roads are open.
        if need == "flow":
            window = ("May to September", "November to April")[south]
            return f"Late wet season, roughly {window}, for the strongest flow"
        window = ("November to April", "May to October")[south]
        return f"Dry season, roughly {window}"

    if b == "subtropical":
        if need == "flow":
            window = ("May to October", "November to April")[south]
            return f"After the rains, roughly {window}"
        window = ("March to May and September to November", "March to May and September to November")
        return f"Spring and autumn, roughly {window[0]}"

    if b == "temperate":
        window = ("May to September", "November to March")[south]
        if need == "flow":
            return f"Late spring to early autumn, roughly {window}, for the best flow"
        return f"Late spring to early autumn, roughly {window}"

    # Polar and sub-polar.
    window = ("June to August", "December to February")[south]
    return f"Short summer, roughly {window}"


def main():
    places = json.load(open("assets/seed-places.json"))
    out = {}
    for p in places:
        lat = p.get("latitude")
        if lat is None:
            continue
        out[p["slug"]] = season(float(lat), p["category"])

    json.dump(out, open("assets/place-season.json", "w"), ensure_ascii=False,
              separators=(",", ":"), sort_keys=True)

    counts = {}
    for v in out.values():
        counts[v.split(",")[0]] = counts.get(v.split(",")[0], 0) + 1
    print(f"{len(out)} places -> assets/place-season.json")
    for k, v in sorted(counts.items(), key=lambda x: -x[1])[:8]:
        print(f"  {v:4d}  {k}")
    for slug in list(out)[:5]:
        print("  ", slug, "|", out[slug])


if __name__ == "__main__":
    main()
