#!/usr/bin/env python3
"""Emit the seed as chunked, quote-proof SQL.

The first version used one giant `values (...)` list. Apostrophes in place names and
Wikipedia text made that fragile: one unescaped quote and Postgres reads the following
words as SQL (which is how you get "relation \"the\" does not exist"). This emits JSON
instead, wrapped in dollar-quoting, so nothing inside the data can ever end a statement.

It also splits the work into small statements: a truncated paste then fails on one
batch instead of the whole file, and each batch reports how many rows it added.

Usage: python3 scripts/emit-seed.py /tmp/rows.json supabase/seed-places-batch.sql
"""

import json
import sys

CHUNK = 150
TAG = "$tl$"

HEADER = """-- TerraLens place seed: real places with real coordinates.
--
-- Every row is a Wikidata item that has coordinates (P625), a country (P17) and an
-- English Wikipedia article. The description is that article's opening sentences.
-- Nothing here is invented: no fee, season or access detail is guessed, so those
-- fields carry an honest "check locally" default for the admin to fill in.
--
-- The data is passed as JSON inside dollar-quoting, so apostrophes in place names and
-- descriptions cannot break the statement.
--
-- Safe to re-run: rows whose slug already exists are skipped.

"""

BATCH = """-- batch {n} of {total}: {count} places
do $$
declare
  added int;
begin
  insert into public.places
    (name, slug, category, country, region, city, latitude, longitude,
     best_season, best_time, access_info, entry_fee, description, status, created_by)
  select x.name, x.slug, x.category, x.country, x.region, x.city, x.latitude, x.longitude,
         'Check the best season locally',
         'Check opening times locally',
         'Check access, opening times and conditions locally before travelling.',
         'Varies. Check before you go.',
         x.description, 'draft',
         (select id from public.profiles order by created_at limit 1)
    from jsonb_to_recordset({tag}{payload}{tag}::jsonb) as x(
           name text, slug text, category text, country text, region text, city text,
           latitude double precision, longitude double precision, description text)
   where not exists (select 1 from public.places p where p.slug = x.slug);

  get diagnostics added = row_count;
  raise notice 'TerraLens batch {n}: % places added', added;
end $$;

"""

FOOTER = """-- Done. Now open /admin.html, go to Places, and tap "Publish all drafts" so the
-- new places are visible and can be indexed.
"""


def main():
    src, dst = sys.argv[1], sys.argv[2]
    rows = json.load(open(src))

    clean = []
    for r in rows:
        clean.append({
            "name": r["name"], "slug": r["slug"], "category": r["category"],
            "country": r["country"], "region": r["region"] or None,
            "city": r["city"] or None,
            "latitude": float(r["lat"]), "longitude": float(r["lon"]),
            "description": r["desc"],
        })

    batches = [clean[i:i + CHUNK] for i in range(0, len(clean), CHUNK)]
    out = [HEADER]
    for n, batch in enumerate(batches, 1):
        payload = json.dumps(batch, ensure_ascii=False, separators=(",", ":"))
        if TAG in payload:  # cannot happen with real data, but never ship a broken file
            raise SystemExit("payload contains the dollar-quote tag")
        out.append(BATCH.format(n=n, total=len(batches), count=len(batch), tag=TAG, payload=payload))
    out.append(FOOTER)

    with open(dst, "w") as f:
        f.write("".join(out))
    print(f"{len(clean)} places in {len(batches)} batches -> {dst}")


if __name__ == "__main__":
    main()
