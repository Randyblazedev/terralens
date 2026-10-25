#!/usr/bin/env python3
"""Build a seed SQL file of REAL places from Wikidata + Wikipedia.

No place here is invented: every row comes from a Wikidata item that has
coordinates, a country, and an English Wikipedia article. The description is
the first sentences of that article, trimmed.

Usage:  python3 scripts/build-seed.py > supabase/seed-places-batch.sql
"""

import json
import re
import sys
import time
import urllib.parse
import urllib.request

UA = "TerraLensSeeder/1.0 (https://terralenss.vercel.app)"
SPARQL = "https://query.wikidata.org/sparql"
WIKI = "https://en.wikipedia.org/api/rest_v1/page/summary/"

# Wikidata class -> TerraLens category
CLASSES = {
    "Waterfall": "Q34038",
    "Mountain": "Q8502",
    "Lake": "Q23397",
    "Beach": "Q40080",
    "Forest": "Q4421",
}

QUERY = """
SELECT ?item ?itemLabel ?coord ?countryLabel ?article ?regionLabel WHERE {{
  ?item wdt:P31/wdt:P279* wd:{qid} ;
        wdt:P625 ?coord ;
        wdt:P17 ?country .
  OPTIONAL {{ ?item wdt:P131 ?region . }}
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikipedia.org/> .
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT {limit} OFFSET {offset}
"""

# Same query restricted to countries on the African continent (Q15). The site is built in
# Cameroon, so African places matter more than another waterfall in Washington State.
QUERY_AFRICA = """
SELECT ?item ?itemLabel ?coord ?countryLabel ?article ?regionLabel WHERE {{
  ?item wdt:P31/wdt:P279* wd:{qid} ;
        wdt:P625 ?coord ;
        wdt:P17 ?country .
  ?country wdt:P30 wd:Q15 .
  OPTIONAL {{ ?item wdt:P131 ?region . }}
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikipedia.org/> .
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT {limit} OFFSET {offset}
"""

# Labels Wikidata sometimes returns that are not a country.
BAD_COUNTRY = {"people", "earth", "world", "europe", "asia", "africa", "q"}


def fetch(url, data=None, headers=None):
    h = {"User-Agent": UA}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def sparql(query):
    body = urllib.parse.urlencode({"query": query}).encode()
    last = None
    for attempt in range(4):
        try:
            raw = fetch(SPARQL, body, {"Accept": "application/sparql-results+json",
                                        "Content-Type": "application/x-www-form-urlencoded"})
            return json.loads(raw)["results"]["bindings"]
        except Exception as e:  # timeouts and 5xx are common on the public endpoint
            last = e
            time.sleep(2 + attempt * 3)
    raise last


def parse_point(wkt):
    m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", wkt or "")
    if not m:
        return None
    return float(m.group(2)), float(m.group(1))  # lat, lon


def wiki_extract(title):
    try:
        raw = fetch(WIKI + urllib.parse.quote(title.replace(" ", "_"), safe=""))
        d = json.loads(raw)
    except Exception:
        return None
    if d.get("type", "").endswith("ambiguation"):
        return None
    text = (d.get("extract") or "").strip()
    return text or None


def slugify(s):
    s = s.lower().replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80] or "place"


def clean(text, limit=420):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if end > 180:
        return cut[:end + 1]
    return cut.rsplit(" ", 1)[0] + "."


def sq(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    seen_slugs = set()
    seen_names = set()
    rows = []
    per_class = int(sys.argv[1]) if len(sys.argv) > 1 else 110
    africa_only = "--africa" in sys.argv

    for category, qid in CLASSES.items():
        got = 0
        offset = 0
        while got < per_class and offset < 900:
            template = QUERY_AFRICA if africa_only else QUERY
            q = template.format(qid=qid, limit=150, offset=offset)
            try:
                bindings = sparql(q)
            except Exception as e:
                print(f"-- {category}: query failed at offset {offset}: {e}", file=sys.stderr)
                break
            if not bindings:
                break
            offset += 150
            for b in bindings:
                if got >= per_class:
                    break
                name = (b.get("itemLabel") or {}).get("value", "").strip()
                if not name or name.startswith("Q"):
                    continue
                coords = parse_point((b.get("coord") or {}).get("value"))
                if not coords:
                    continue
                country = (b.get("countryLabel") or {}).get("value", "").strip()
                if not country or country.lower() in BAD_COUNTRY:
                    continue
                slug = slugify(name)
                if slug in seen_slugs or name.lower() in seen_names:
                    continue
                article = (b.get("article") or {}).get("value", "")
                title = urllib.parse.unquote(article.rsplit("/", 1)[-1]).replace("_", " ")
                desc = wiki_extract(title)
                if not desc or len(desc) < 90:
                    continue
                desc = clean(desc)
                region = (b.get("regionLabel") or {}).get("value", "").strip()
                if region.startswith("Q"):
                    region = ""
                lat, lon = coords
                seen_slugs.add(slug)
                seen_names.add(name.lower())
                rows.append({
                    "name": name, "slug": slug, "category": category,
                    "country": country, "region": region[:80], "city": "",
                    "lat": round(lat, 5), "lon": round(lon, 5),
                    "description": desc,
                })
                got += 1
            time.sleep(0.4)
        print(f"-- {category}: {got} places", file=sys.stderr)

    print(f"-- TerraLens place seed batch: {len(rows)} real places from Wikidata + Wikipedia")
    print("-- Every row has coordinates, a country and an English Wikipedia article behind it.")
    print("-- Descriptions are the article's opening sentences, trimmed. No price or access detail")
    print("-- is invented: those fields carry an honest 'check locally' default instead.")
    print()
    print("insert into public.places")
    print("  (name, slug, category, country, region, city, latitude, longitude,")
    print("   best_season, best_time, access_info, entry_fee, description, status, created_by)")
    print("select v.name, v.slug, v.category, v.country, v.region, v.city, v.latitude, v.longitude,")
    print("       'Check the best season locally', 'Check opening times locally',")
    print("       'Check access, opening times and conditions locally before travelling.',")
    print("       'Varies. Check before you go.', v.description, 'draft',")
    print("       (select id from public.profiles order by created_at limit 1)")
    print("  from (values")
    out = []
    for r in rows:
        out.append(
            "  ({}, {}, {}, {}, {}, {}, {}, {}, {})".format(
                sq(r["name"]), sq(r["slug"]), sq(r["category"]), sq(r["country"]),
                sq(r["region"]), sq(r["city"]), r["lat"], r["lon"], sq(r["description"])
            )
        )
    print(",\n".join(out))
    print(") as v(name, slug, category, country, region, city, latitude, longitude, description)")
    print("where not exists (select 1 from public.places p where p.slug = v.slug);")


if __name__ == "__main__":
    main()
