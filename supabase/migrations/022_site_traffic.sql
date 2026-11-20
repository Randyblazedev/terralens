-- Daily traffic stats for the admin panel.
-- place_views already records one row per place per viewer per day; this aggregates it by day.

create or replace function public.site_traffic(p_days integer default 14)
returns table (day date, views bigint, visitors bigint)
language sql stable security definer set search_path = public as $$
  select v.day,
         count(*) as views,
         count(distinct v.viewer) as visitors
  from public.place_views v
  where public.is_admin()
    and v.day >= current_date - (least(greatest(p_days, 1), 90) - 1)
  group by v.day
  order by v.day desc;
$$;

revoke all on function public.site_traffic(integer) from public, anon;
grant execute on function public.site_traffic(integer) to authenticated;

create or replace function public.site_totals()
returns table (total_views bigint, today_views bigint, unique_visitors bigint, days_tracked bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.place_views where public.is_admin()),
    (select count(*) from public.place_views where public.is_admin() and day = current_date),
    (select count(distinct viewer) from public.place_views where public.is_admin()),
    (select count(distinct day) from public.place_views where public.is_admin());
$$;

revoke all on function public.site_totals() from public, anon;
grant execute on function public.site_totals() to authenticated;
