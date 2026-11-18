#!/usr/bin/env python3
"""Seed starter collections, trips and chat from real published places.

Run with a Supabase service-role key:
  python3 scripts/seed-cold-start.py <service-role-key>
"""
import json, os, sys, urllib.request

URL = os.environ.get("SUPABASE_URL", "https://zaxqrmavoqhrqhbdktez.supabase.co")
ADMIN_ID = "491ce345-02de-4ec0-aa25-4960b288da3c"

def req(path, key, method="GET", body=None):
    headers = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(URL + path, headers=headers, method=method, data=data)
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read().decode()
        return json.loads(raw) if raw else None

def main():
    key = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        print("Pass a service-role key: python3 scripts/seed-cold-start.py <key>")
        return
    places = req("/rest/v1/places?select=id,name,country,category&status=eq.published&limit=1000", key)
    by_cat = {}
    for place in places:
        by_cat.setdefault(place["category"], []).append(place)

    starters = [
        ("Waterfalls worth the walk", "A short list of falls where the walk is part of the reward.", "Waterfall"),
        ("Big mountains", "Peaks that make the horizon look different.", "Mountain"),
        ("Where the water is blue", "Lakes and lagoons worth planning a day around.", "Lake"),
    ]
    for name, description, category in starters:
        items = by_cat.get(category, [])[:6]
        if not items:
            continue
        existing = req("/rest/v1/collections?select=id&name=eq." + urllib.parse.quote(name) + "&limit=1", key)
        if existing:
            continue
        collection = req("/rest/v1/collections", key, "POST", {
            "user_id": ADMIN_ID, "name": name, "description": description, "is_public": True
        })[0]
        req("/rest/v1/collection_items", key, "POST", [
            {"collection_id": collection["id"], "place_id": item["id"]} for item in items
        ])
        print("seeded collection:", name, len(items), "places")

    trip_items = by_cat.get("Waterfall", [])[:3] + by_cat.get("Lake", [])[:2]
    if trip_items:
        existing = req("/rest/v1/trips?select=id&name=eq.Week%20in%20the%20wild&limit=1", key)
        if not existing:
            trip = req("/rest/v1/trips", key, "POST", {
                "user_id": ADMIN_ID, "name": "Week in the wild",
                "description": "Five days of waterfalls and lakes, ready to remix."
            })[0]
            req("/rest/v1/trip_places", key, "POST", [
                {"trip_id": trip["id"], "place_id": item["id"], "day_number": index + 1}
                for index, item in enumerate(trip_items)
            ])
            print("seeded trip: Week in the wild")

    messages = [
        "Welcome. Share a place you loved and what made it worth the trip.",
        "If you are in Cameroon, start with Mount Cameroon and Lake Nyos.",
        "Looking for a waterfall? The Waterfall category has hundreds to browse.",
    ]
    for body in messages:
        existing = req("/rest/v1/community_messages?select=id&body=eq." + urllib.parse.quote(body) + "&limit=1", key)
        if existing:
            continue
        req("/rest/v1/community_messages", key, "POST", {"user_id": ADMIN_ID, "body": body})
        print("seeded chat:", body[:40])

if __name__ == "__main__":
    import urllib.parse
    main()
