-- One view per person per place, not per day.
-- Drop the old composite PK and recreate with just (place_id, viewer).
ALTER TABLE public.place_views DROP CONSTRAINT IF EXISTS place_views_pkey;
ALTER TABLE public.place_views ADD CONSTRAINT place_views_pkey PRIMARY KEY (place_id, viewer);
