-- Unify athlete-facing plans and payment concepts as one service catalog entry.
alter table public.membership_plans
  add column if not exists payment_concept_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname='membership_plans_payment_concept_id_fkey'
       and conrelid='public.membership_plans'::regclass
  ) then
    alter table public.membership_plans
      add constraint membership_plans_payment_concept_id_fkey
      foreign key (payment_concept_id)
      references public.payment_concepts(id)
      on delete set null;
  end if;
end;
$$;

create unique index if not exists membership_plans_payment_concept_unique
  on public.membership_plans(payment_concept_id)
  where payment_concept_id is not null;

-- Link existing plans to a same-named concept, creating one when necessary.
do $$
declare r record; v_concept_id uuid;
begin
  for r in select id,club_id,name,price,active from public.membership_plans loop
    select id into v_concept_id
      from public.payment_concepts
     where club_id=r.club_id and lower(btrim(name))=lower(btrim(r.name))
     order by created_at,id
     limit 1;
    if v_concept_id is null then
      insert into public.payment_concepts(club_id,name,description,default_amount,active)
      values(r.club_id,r.name,'Servicio vinculado a plan para deportistas',r.price,r.active)
      returning id into v_concept_id;
    end if;
    update public.membership_plans set payment_concept_id=v_concept_id where id=r.id;
  end loop;
end;
$$;

create or replace function public.delete_athlete_service_v1(
  p_plan_id uuid,
  p_payment_concept_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_club_id uuid := private.current_club_id();
  v_role text := private.current_role();
  v_plan public.membership_plans%rowtype;
  v_concept public.payment_concepts%rowtype;
  v_has_memberships boolean := false;
begin
  if v_club_id is null or v_role not in ('owner','admin') then
    raise exception 'Solo administradores y propietarios pueden eliminar servicios';
  end if;
  if p_plan_id is null and p_payment_concept_id is null then
    raise exception 'Selecciona un servicio válido';
  end if;

  if p_plan_id is not null then
    select * into v_plan from public.membership_plans
     where id=p_plan_id and club_id=v_club_id for update;
    if not found then raise exception 'El plan no existe en el club activo'; end if;
    select exists(select 1 from public.memberships where plan_id=p_plan_id and club_id=v_club_id)
      into v_has_memberships;
    if v_has_memberships then
      update public.membership_plans set active=false where id=p_plan_id;
      if v_plan.payment_concept_id is not null then
        update public.payment_concepts set active=false
         where id=v_plan.payment_concept_id and club_id=v_club_id;
      end if;
      return 'archived';
    end if;
    if p_payment_concept_id is not null
       and v_plan.payment_concept_id is distinct from p_payment_concept_id then
      raise exception 'El plan y el concepto no corresponden al mismo servicio';
    end if;
    delete from public.membership_plans where id=p_plan_id and club_id=v_club_id;
    p_payment_concept_id := coalesce(p_payment_concept_id,v_plan.payment_concept_id);
  end if;

  if p_payment_concept_id is not null then
    select * into v_concept from public.payment_concepts
     where id=p_payment_concept_id and club_id=v_club_id for update;
    if found then
      delete from public.payment_concepts
       where id=p_payment_concept_id and club_id=v_club_id;
      return 'deleted';
    elsif p_plan_id is null then
      raise exception 'El concepto no existe en el club activo';
    end if;
  end if;
  return 'deleted';
end;
$function$;

revoke all on function public.delete_athlete_service_v1(uuid,uuid) from public,anon;
grant execute on function public.delete_athlete_service_v1(uuid,uuid) to authenticated;

comment on function public.delete_athlete_service_v1(uuid,uuid) is
'Deletes unused athlete services; archives a service when memberships reference its plan. Payment snapshots are preserved by FK SET NULL.';
notify pgrst,'reload schema';
