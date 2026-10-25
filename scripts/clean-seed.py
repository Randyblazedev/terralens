#!/usr/bin/env python3
"""Clean the generated seed SQL: de-duplicate descriptions and give any repeated
or too-short one an honest fallback built from the place's own fields.

Wikipedia sometimes reuses the same opening sentence for several places (a group
of waterfalls in one city, for example). Shipping the same paragraph on five
pages is exactly the thin content search engines punish, so those rows get a
short factual line instead.

Usage: python3 scripts/clean-seed.py in.sql out.sql
"""

import re
import sys

ROW = re.compile(
    r"^  \('(?P<name>(?:[^']|'')*)', '(?P<slug>[^']*)', '(?P<category>[^']*)', "
    r"'(?P<country>(?:[^']|'')*)', '(?P<region>(?:[^']|'')*)', '(?P<city>(?:[^']|'')*)', "
    r"(?P<lat>-?[\d.]+), (?P<lon>-?[\d.]+), '(?P<desc>(?:[^']|'')*)'\)"
)

FALLBACK = {
    "Waterfall": "A waterfall in {country}. Check local guides for access, the best season and any entry fee before you travel.",
    "Mountain": "A mountain in {country}. Check local guides for routes, conditions and permits before you climb.",
    "Lake": "A lake in {country}. Check local guides for access, boat hire and the best season before you visit.",
    "Beach": "A beach in {country}. Check local guides for access, swimming conditions and facilities before you go.",
    "Forest": "A forest in {country}. Check local guides for trails, opening times and permits before you visit.",
}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    text = open(src).read()
    head, _, rest = text.partition("  from (values\n")
    body, _, tail = rest.rpartition("\n) as v(")

    rows = []
    seen = set()
    for line in body.split("\n"):
        m = ROW.match(line)
        if not m:
            continue
        d = m.groupdict()
        rows.append(d)

    out, replaced = [], 0
    for d in rows:
        desc = d["desc"].replace("''", "'")
        key = re.sub(r"\W+", " ", desc.lower()).strip()
        if len(desc) < 80 or key in seen:
            desc = FALLBACK[d["category"]].format(country=d["country"].replace("''", "'"))
            replaced += 1
        seen.add(key)
        d["desc_sql"] = desc.replace("'", "''")
        out.append(
            "  ('{name}', '{slug}', '{category}', '{country}', '{region}', '{city}', {lat}, {lon}, '{desc}')".format(
                name=d["name"], slug=d["slug"], category=d["category"], country=d["country"],
                region=d["region"], city=d["city"], lat=d["lat"], lon=d["lon"], desc=d["desc_sql"]
            )
        )

    with open(dst, "w") as f:
        f.write(head + "  from (values\n" + ",\n".join(out) + "\n) as v(" + tail)
    print(f"{len(out)} rows written, {replaced} descriptions replaced with an honest fallback", file=sys.stderr)


if __name__ == "__main__":
    main()
