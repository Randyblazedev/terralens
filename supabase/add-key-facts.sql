-- One-line change: a place can carry real, sourced measurements
-- (elevation, height, surface area, maximum depth) pulled from Wikidata.
-- Safe to run more than once.
alter table public.places add column if not exists key_facts text;
