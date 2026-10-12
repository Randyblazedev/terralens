-- seed-posts.sql: three starter blog articles. Run ONCE in the Supabase SQL editor after schema.sql, after you have
-- signed in with your admin Google account and added yourself to public.admins. Safe to re-run (existing posts are skipped).
-- Edit or delete them any time in /admin.html -> Blog.
do $$
declare owner uuid;
begin
  select u.id into owner from auth.users u join public.admins a on a.email = lower(u.email) order by a.email limit 1;
  if owner is null then
    raise exception 'Sign in to TerraLens with your admin Google account first, and add that email to public.admins.';
  end if;
  insert into public.profiles (id) values (owner) on conflict (id) do nothing;

  insert into public.posts (slug, title, excerpt, content, category, status, author_id) values
  ('how-to-photograph-waterfalls',
   'How to Photograph Waterfalls: 9 Tips for Sharp, Silky Photos',
   'Learn how to photograph waterfalls with the right shutter speed, a tripod, a polarizing filter and better timing, for silky water and sharp rocks.',
   $md$Waterfalls are some of the most rewarding places to photograph, and some of the easiest to get wrong. Bright water, dark rock and constant spray all fight your camera. These nine tips will help you come home with photos that look like the place felt.

## 1. Go when the light is soft

Harsh midday sun burns out the white water and leaves deep, ugly shadows on the rocks. Overcast days, early mornings and late afternoons give soft, even light. Many waterfalls sit in gorges, so the light there can be good even at midday, but always check for sun spots that cross the water.

## 2. Use a tripod

The famous silky look comes from a slow shutter speed, and you cannot hold a camera steady for a full second. A small travel tripod is the single best upgrade for waterfall photos. No tripod? Rest the camera on a rock or your bag and use the two-second timer.

## 3. Choose your shutter speed on purpose

- **Silky water:** try 0.5 to 2 seconds. Lower the shutter speed for gentle flow and raise it for powerful falls.
- **Frozen spray:** use 1/500 of a second or faster to show every drop.

Take both. The same waterfall can tell two different stories.

## 4. Keep the ISO low and the aperture small

Set the lowest ISO your camera has, then close the aperture to around f/8 to f/16. This keeps everything sharp and also helps you reach a slow shutter speed in bright conditions.

## 5. Add a polarizing filter

A circular polarizer removes glare from wet rocks and leaves, and makes greens look richer. It also cuts light, which helps with slow shutter speeds. In very bright light, a neutral density filter helps even more.

## 6. Protect your gear

Spray is invisible until your lens is covered in it. Keep a microfiber cloth in a dry pocket, wipe often, and put the lens hood on. Do not change lenses in the spray. A rain cover or a plastic bag with a hole for the lens is cheap insurance.

## 7. Compose with depth and scale

A waterfall alone can look flat. Add a foreground, such as a wet rock, a fern or a curve of the stream, and let it lead the eye to the falls. A small figure on a viewing platform shows how big the falls really are.

## 8. Check the season and water level

The same waterfall can be a thundering wall of water in one season and a trickle in another. Check the best season before you travel, and read our guide to [choosing the best time to visit](/blog/best-time-to-visit-waterfalls-beaches-mountains).

## 9. Stay safe

Wet rocks are slippery, and edges can crumble. Stay behind barriers, follow local rules, and never take a risk for a photo. Check whether you need a permit before flying a drone.

Ready to find your next waterfall? Browse all [waterfalls on TerraLens](/category/waterfall), or [plan a trip](/planner.html) that fits several of them into a few days.$md$,
   'photography', 'published', owner),

  ('plan-a-multi-place-trip',
   'How to Plan a Multi-Place Trip Without Wasting Days on the Road',
   'A simple method for planning a trip with several stops: group places by region, limit each day, check seasons and access, and leave room for rest.',
   $md$The best trips often include several places, but the plan can fall apart if you spend half your time in a car. This simple method keeps your days full without making them rushed.

## 1. Start with your must-see places

Write down the three to five places you would be most disappointed to miss. Everything else is a bonus. On TerraLens you can save places as you browse, so your shortlist is ready when you start planning.

## 2. Group places by region

Look at where each place is on the map and group the close ones together. Two places 40 kilometres apart can share a day. Two places 400 kilometres apart usually cannot. A good rule of thumb on country roads is an average of 50 to 60 kilometres per hour, which is slower than most people expect once you add stops, traffic and rough surfaces.

## 3. Limit each day to two or three places

One main place in the morning and one in the afternoon is a comfortable pace. Add a third only when it is very close or quick to see. Remember that big places, such as national parks, can take a full day on their own.

## 4. Check the best season for every place

A trip is only as good as its worst-timed stop. Check the best season and best time of day for each place, and note any that fall outside your dates. You can still visit them, but plan for different conditions, such as lower water at a waterfall or hazy views from a mountain.

## 5. Read how to get there

Some places need a guide, a permit, a boat or a long walk. Read the access notes in advance so you do not lose a morning to a closed road or a ticket office that only opens early. Entry fees also change, so confirm them before you go.

## 6. Add buffer and rest

Plan one lighter day for every four or five busy ones, and leave a gap for delays. Border crossings, ferries and long drives always take longer than the map says.

## 7. Let the planner do the sorting

The free [TerraLens trip planner](/planner.html) does steps 2, 3 and 4 for you. Add your places, choose your dates, and it groups nearby places into days, shows the distance and travel time between them, and warns you when a place is outside its best season.

Looking for ideas first? [Explore places](/explore.html) by category and country, then save the ones you love.$md$,
   'travel-tips', 'published', owner),

  ('best-time-to-visit-waterfalls-beaches-mountains',
   'How to Choose the Best Time to Visit a Waterfall, Beach or Mountain',
   'The best season depends on the kind of place. Learn what to check for waterfalls, beaches and mountains, and how time of day changes your trip.',
   $md$"When should I go?" is the most important question in trip planning, and the answer depends on the kind of place. Here is how to think about it for waterfalls, beaches and mountains, plus a few rules that work almost everywhere.

## Waterfalls: follow the water

Waterfalls are strongest after the rainy season and weakest at the end of the dry season. Many people prefer the biggest flow, but there is a trade-off: in peak flow the spray can hide the view, and some viewpoints or swimming spots close for safety. Visiting shortly after the peak often gives the best mix of strong water and clear views. Check the local pattern for each place, because rainy seasons differ by region.

Browse our [waterfalls](/category/waterfall) and read the best season for each one.

## Beaches: calm sea and dry weather

For beaches, you usually want the dry season, when skies are clearer and the sea is calmer. Check for a stormy or jellyfish season, and for months when seaweed or strong currents are common. If a beach depends on low tide, as with tidal rock arches, check the tide tables for your exact day.

## Mountains: clear views and safe conditions

Mountain weather decides everything. The dry season usually brings clearer views and safer trails, while the wet season can bring cloud, slippery paths and closed routes. For high peaks, also consider snow, cold and short daylight. Mornings are often clearer than afternoons, when cloud builds up.

## Time of day matters as much as the season

- **Early morning** has soft light, fewer people and calmer water.
- **Late afternoon** has warm light and is a good second choice.
- **Midday** is the harshest light and often the busiest time.

## Rules that work almost everywhere

1. **Check the season for your exact place**, not just the country. A region can have two very different climates.
2. **Look at the shoulder seasons.** The weeks just before or after peak season often give good weather with fewer visitors and lower prices.
3. **Check the forecast close to your trip**, and keep a spare day in case a place is closed.
4. **Plan the whole route by season.** If your trip includes several places, a tool like the [TerraLens planner](/planner.html) can warn you when one of them is outside its best season.

Every place on TerraLens lists its best season and best time of day. Start with the [places you can explore](/explore.html) and build a trip around the right months.$md$,
   'travel-tips', 'published', owner)
  on conflict (slug) do nothing;
end $$;
