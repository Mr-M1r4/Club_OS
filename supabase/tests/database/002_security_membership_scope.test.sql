-- Security regression tests for active tenant membership and exposed schemas.
begin;
select plan(3);

select ok(
  position('cm.active' in pg_get_functiondef('private.current_club_id()'::regprocedure)) > 0,
  'active club resolver requires an active club membership'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  'all public tables and partitioned tables have RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'membership_arrears'
      and c.relkind = 'v'
      and c.reloptions @> array['security_invoker=true']
  ),
  'membership arrears view invokes underlying RLS policies'
);

select * from finish();
rollback;
