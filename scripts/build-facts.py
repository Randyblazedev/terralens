#!/usr/bin/env python3
"""Real, sourced measurements for every seeded place.

Lookup route: ask Wikidata's search API for the place name, take the best matching
item, then fetch elevation / height / surface area / maximum depth for a batch of
those item ids in one query.

That replaces the previous label-matching query, which returned HTTP 400 on some
batches because a place name in a VALUES list can contain characters that break the
query. Item ids cannot.

Output: assets/place-facts.json -> { "<slug>": "Height 222 m", ... }

Usage: python3 scripts/build-facts.py [--missing]
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request

UA = "TerraLensFacts/1.2 (https://terralenss.vercel.app)"
SPARQL = "https://query.wikidata.org/sparql"
SEARCH = "https://www.wikidata.org/w/api.php"
BATCH = 50

# Which measurement means something for each kind of place. An elevation of "2 m" on a
# beach is true and useless, so it is never shown.
ALLOWED = {
    "Mountain": ("elev",),
    "Waterfall": ("height",),
    "Lake": ("area", "depth", "elev"),
    "Beach": (),
    "Forest": ("area",),
}

QUERY = """
SELECT ?item ?elev ?height ?area ?depth WHERE {{
  VALUES ?item {{ {ids} }}
  OPTIONAL {{ ?item p:P2044/psv:P2044 [ wikibase:quantityAmount ?elev ; wikibase:quantityUnit wd:Q11573 ] . }}
  OPTIONAL {{ ?item p:P2048/psv:P2048 [ wikibase:quantityAmount ?height ; wikibase:quantityUnit wd:Q11573 ] . }}
  OPTIONAL {{ ?item p:P2046/psv:P2046 [ wikibase:quantityAmount ?area ; wikibase:quantityUnit wd:Q25343 ] . }}
  OPTIONAL {{ ?item p:P4511/psv:P4511 [ wikibase:quantityAmount ?depth ; wikibase:quantityUnit wd:Q11573 ] . }}
  FILTER(BOUND(?elev) || BOUND(?height) || BOUND(?area) || BOUND(?depth))
}}
"""


def get(url, params=None, sparql=None, timeout=90):
    if sparql is not None:
        data = urllib.parse.urlencode({"query": sparql}).encode()
        headers = {"User-Agent": UA, "Accept": "application/sparql-results+json",
                   "Content-Type": "application/x-www-form-urlencoded"}
        req = urllib.request.Request(SPARQL, data=data, headers=headers)
    else:
        req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(params)}",
                                     headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def retry(fn, tries=4):
    last = None
    for attempt in range(tries):
        try:
            return fn()
        except Exception as e:
            last = e
            time.sleep(2 + attempt * 3)
    raise last


def find_qid(name, country=None):
    """Best-guess Wikidata item for a place name."""
    def go():
        return get(SEARCH, {
            "action": "wbsearchentities", "search": name, "language": "en",
            "format": "json", "limit": "5", "type": "item",
        })
    try:
        data = retry(go)
    except Exception:
        return None
    hits = data.get("search") or []
    if not hits:
        return None
    # Prefer an exact label match, otherwise the first hit.
    for h in hits:
        if (h.get("label") or "").strip().lower() == name.strip().lower():
            return h["id"]
    return hits[0]["id"]


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def fmt_m(value):
    return f"{value:,.0f} m" if abs(value) >= 1000 else f"{value:.0f} m"


def facts_from(row, category):
    allow = ALLOWED.get(category, ())
    elev = num((row.get("elev") or {}).get("value"))
    height = num((row.get("height") or {}).get("value"))
    area = num((row.get("area") or {}).get("value"))
    depth = num((row.get("depth") or {}).get("value"))
    bits = []
    if "elev" in allow and elev is not None:
        bits.append(f"Elevation {fmt_m(elev)}")
    if "height" in allow and height is not None:
        bits.append(f"Height {fmt_m(height)}")
    if "depth" in allow and depth is not None:
        bits.append(f"Max depth {fmt_m(depth)}")
    if "area" in allow and area is not None:
        km2 = area / 1_000_000
        bits.append(f"Surface area {km2:,.0f} km²" if km2 >= 100 else f"Surface area {km2:,.1f} km²")
    return " · ".join(bits)


def main():
    places = json.load(open("assets/seed-places.json"))
    try:
        facts = json.load(open("assets/place-facts.json"))
    except Exception:
        facts = {}

    only_missing = "--missing" in sys.argv
    todo = [p for p in places if not (only_missing and p["slug"] in facts)]
    print(f"{len(todo)} places to look up, {len(facts)} already known", file=sys.stderr)

    # 1. name -> Wikidata item id
    qid_for = {}
    for i, p in enumerate(todo, 1):
        qid = find_qid(p["name"], p.get("country"))
        if qid:
            qid_for[p["slug"]] = (qid, p["category"])
        if i % 50 == 0:
            print(f"  resolved {i}/{len(todo)}", file=sys.stderr)
        time.sleep(0.08)

    print(f"{len(qid_for)} items found", file=sys.stderr)

    # 2. measurements for those items, in batches
    by_qid = {}
    for slug, (qid, category) in qid_for.items():
        by_qid.setdefault(qid, (slug, category))

    ids = list(by_qid)
    for i in range(0, len(ids), BATCH):
        chunk = ids[i:i + BATCH]
        values = " ".join(f"wd:{q}" for q in chunk)
        try:
            data = retry(lambda: get(None, sparql=QUERY.format(ids=values)))
        except Exception as e:
            print(f"  batch {i//BATCH+1} failed: {e}", file=sys.stderr)
            continue
        for row in data["results"]["bindings"]:
            qid = row["item"]["value"].rsplit("/", 1)[-1]
            slug, category = by_qid.get(qid, (None, None))
            if not slug:
                continue
            text = facts_from(row, category)
            if text:
                facts[slug] = text
        time.sleep(0.4)
        print(f"  measurements {min(i+BATCH, len(ids))}/{len(ids)}", file=sys.stderr)

    json.dump(facts, open("assets/place-facts.json", "w"), ensure_ascii=False,
              separators=(",", ":"), sort_keys=True)
    print(f"{len(facts)} of {len(places)} places have real measurements")
    for slug in list(facts)[:6]:
        print("  ", slug, "|", facts[slug])


if __name__ == "__main__":
    main()
