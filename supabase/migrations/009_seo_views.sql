-- 009_seo_views.sql (only needed if you do NOT run the full schema.sql)

-- ===== SEO: category and country counts for landing pages and sitemaps =====
-- security_invoker means these views only see what a visitor may see (published places).
create or replace view public.place_category_counts with (security_invoker = true) as
  select category, count(*)::int as places from public.places
  where status = 'published' and category is not null group by category;
create or replace view public.place_country_counts with (security_invoker = true) as
  select country, count(*)::int as places from public.places
  where status = 'published' and country is not null group by country;
grant select on public.place_category_counts, public.place_country_counts to anon, authenticated;
-- Fast filtering for the landing pages when there are very many places.
create index if not exists places_published_category_idx on public.places (category, created_at desc) where status = 'published';
create index if not exists places_published_country_idx on public.places (country, created_at desc) where status = 'published';
create index if not exists places_published_updated_idx on public.places (created_at desc) where status = 'published';
