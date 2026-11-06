-- Require a live membership in the selected club before any tenant-scoped
-- RLS policy can resolve an active club. This closes stale-session access after
-- an administrator disables a club membership.
create or replace function private.current_club_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select p.active_club_id
  from public.profiles p
  where p.id = (select auth.uid())
    and (
      exists (
        select 1
        from public.club_memberships cm
        where cm.user_id = p.id
          and cm.club_id = p.active_club_id
          and cm.active = true
      )
      or exists (
        select 1
        from public.platform_admins pa
        where pa.user_id = p.id
      )
    )
$function$;

revoke all on function private.current_club_id() from public, anon;
grant execute on function private.current_club_id() to authenticated;

comment on function private.current_club_id() is
  'Returns the selected club only while the caller has an active membership in it, or is a platform administrator.';

notify pgrst, 'reload schema';
