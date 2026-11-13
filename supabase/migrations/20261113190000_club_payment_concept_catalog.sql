-- Per-club editable payment concept catalog for charges to athletes.
-- membership_plans are the athlete-facing plans sold by each club and carry duration.
-- They are NOT ClubOS SaaS subscriptions: saas_subscriptions and saas_payments
-- remain a separate platform-billing domain, managed only by platform administrators.
-- Both athlete plans and general athlete-payment concepts are selectable in Caja y pagos.

create table if not exists public.payment_concepts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null default private.current_club_id()
    references public.clubs(id) on delete cascade,
  name text not null,
  description text,
  default_amount numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint payment_concepts_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint payment_concepts_amount_nonnegative check (default_amount >= 0)
);

create unique index if not exists payment_concepts_club_name_uidx
  on public.payment_concepts (club_id, lower(btrim(name)));
create index if not exists payment_concepts_club_active_idx
  on public.payment_concepts (club_id, active, lower(name));

alter table public.payment_concepts enable row level security;

drop policy if exists payment_concepts_select on public.payment_concepts;
create policy payment_concepts_select on public.payment_concepts
  for select to authenticated
  using (club_id = private.current_club_id());

drop policy if exists payment_concepts_insert on public.payment_concepts;
create policy payment_concepts_insert on public.payment_concepts
  for insert to authenticated
  with check (
    club_id = private.current_club_id()
    and private.current_role() in ('owner','admin')
  );

drop policy if exists payment_concepts_update on public.payment_concepts;
create policy payment_concepts_update on public.payment_concepts
  for update to authenticated
  using (
    club_id = private.current_club_id()
    and private.current_role() in ('owner','admin')
  )
  with check (
    club_id = private.current_club_id()
    and private.current_role() in ('owner','admin')
  );

drop policy if exists payment_concepts_delete on public.payment_concepts;
create policy payment_concepts_delete on public.payment_concepts
  for delete to authenticated
  using (
    club_id = private.current_club_id()
    and private.current_role() in ('owner','admin')
  );

grant select, insert, update, delete on public.payment_concepts to authenticated;

-- Editable starter values, not a closed or enforced list. Each club can rename,
-- reprice, archive, or add concepts independently.
insert into public.payment_concepts (club_id, name, description, default_amount)
select c.id, seed.name, seed.description, 0
from public.clubs c
cross join (values
  ('Mensualidad'::text, 'Concepto inicial editable'::text),
  ('Inscripción'::text, 'Concepto inicial editable'::text),
  ('Producto'::text, 'Concepto inicial editable'::text)
) as seed(name, description)
on conflict (club_id, (lower(btrim(name)))) do nothing;

alter table public.payments
  add column if not exists payment_concept_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_payment_concept_id_fkey'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_payment_concept_id_fkey
      foreign key (payment_concept_id)
      references public.payment_concepts(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists payments_club_payment_concept_idx
  on public.payments (club_id, payment_concept_id)
  where payment_concept_id is not null;

-- Extend the already-versioned trigger from the preceding migration. A payment
-- may reference either a membership plan or a general club concept, never both.
create or replace function private.sync_payment_plan_concept()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_plan public.membership_plans%rowtype;
  v_concept public.payment_concepts%rowtype;
begin
  if new.plan_id is not null and new.payment_concept_id is not null then
    raise exception 'Un pago no puede tener simultáneamente un plan y un concepto general';
  end if;

  if new.payment_concept_id is not null then
    select * into v_concept
      from public.payment_concepts
     where id = new.payment_concept_id;

    if not found then
      raise exception 'El concepto seleccionado no existe';
    end if;
    if v_concept.club_id is distinct from new.club_id then
      raise exception 'El concepto no pertenece al club activo';
    end if;
    -- An archived concept may remain attached to its existing payment,
    -- but cannot be assigned to a new payment or swapped onto another one.
    if not v_concept.active
       and not (tg_op = 'UPDATE' and old.payment_concept_id is not distinct from new.payment_concept_id) then
      raise exception 'No se pueden registrar pagos con un concepto archivado';
    end if;

    new.concept := 'membership'::public.payment_concept;
    -- Keep the payment-time label immutable when the same concept is retained.
    -- A newly selected concept receives its current name as the snapshot.
    if tg_op = 'UPDATE' and old.payment_concept_id is not distinct from new.payment_concept_id then
      new.concept_label := old.concept_label;
    else
      new.concept_label := v_concept.name;
    end if;
    return new;
  end if;

  if new.plan_id is null then
    -- Preserve immutable historical labels when an FK is cleared by deletion.
    if tg_op = 'UPDATE' then
      if new.concept_label is not distinct from old.concept_label then
        new.concept_label := old.concept_label;
      else
        new.concept_label := null;
      end if;
    else
      new.concept_label := null;
    end if;
    return new;
  end if;

  select * into v_plan
    from public.membership_plans
   where id = new.plan_id;

  if not found then
    raise exception 'El plan seleccionado no existe';
  end if;
  if v_plan.club_id is distinct from new.club_id then
    raise exception 'El plan no pertenece al club activo';
  end if;

  if tg_op = 'INSERT' then
    if not v_plan.active then
      raise exception 'No se pueden registrar pagos con un plan archivado';
    end if;
    new.concept_label := v_plan.name;
  elsif old.plan_id is distinct from new.plan_id then
    if not v_plan.active then
      raise exception 'No se pueden registrar pagos con un plan archivado';
    end if;
    new.concept_label := v_plan.name;
  else
    new.concept_label := old.concept_label;
  end if;

  new.concept := 'membership'::public.payment_concept;
  return new;
end;
$function$;

drop trigger if exists payments_sync_plan_concept on public.payments;
create trigger payments_sync_plan_concept
before insert or update of plan_id, payment_concept_id, concept_label, concept, club_id
on public.payments
for each row
execute function private.sync_payment_plan_concept();

-- New RPC version adds the club-scoped general concept reference without
-- changing either legacy update_payment_admin or the earlier v2 contract.
create or replace function public.update_payment_admin_v3(
  p_payment_id uuid,
  p_athlete_id uuid,
  p_concept public.payment_concept,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_status public.payment_status,
  p_paid_at timestamptz,
  p_plan_id uuid,
  p_payment_concept_id uuid,
  p_concept_label text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_club_id uuid := private.current_club_id();
  v_old public.payments;
  v_new public.payments;
  v_plan public.membership_plans%rowtype;
  v_concept public.payment_concepts%rowtype;
begin
  if (select private.current_role()) not in ('owner','admin') then
    raise exception 'Solo administradores y propietarios pueden editar pagos';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'El valor del pago debe ser cero o mayor';
  end if;
  if p_athlete_id is not null and not exists (
    select 1 from public.athletes
     where id = p_athlete_id and club_id = v_club_id
  ) then
    raise exception 'El deportista no pertenece al club activo';
  end if;

  select * into v_old
    from public.payments
   where id = p_payment_id and club_id = v_club_id
   for update;
  if not found then
    raise exception 'Pago no encontrado en el club activo';
  end if;

  if p_plan_id is not null and p_payment_concept_id is not null then
    raise exception 'Selecciona un plan o un concepto, no ambos';
  end if;

  if p_plan_id is not null then
    select * into v_plan from public.membership_plans
     where id = p_plan_id and club_id = v_club_id;
    if not found then
      raise exception 'El plan no pertenece al club activo';
    end if;
    if not v_plan.active and p_plan_id is distinct from v_old.plan_id then
      raise exception 'No se puede asignar un plan archivado a otro pago';
    end if;
  end if;

  if p_payment_concept_id is not null then
    select * into v_concept from public.payment_concepts
     where id = p_payment_concept_id and club_id = v_club_id;
    if not found then
      raise exception 'El concepto no pertenece al club activo';
    end if;
    if not v_concept.active and p_payment_concept_id is distinct from v_old.payment_concept_id then
      raise exception 'No se puede asignar un concepto archivado a otro pago';
    end if;
  end if;

  update public.payments
     set athlete_id = p_athlete_id,
         concept = case
           when p_plan_id is not null or p_payment_concept_id is not null
             then 'membership'::public.payment_concept
           else p_concept
         end,
         plan_id = p_plan_id,
         payment_concept_id = p_payment_concept_id,
         concept_label = case
           when p_plan_id is not null then v_plan.name
           when p_payment_concept_id is not null then v_concept.name
           else p_concept_label
         end,
         amount = p_amount,
         method = nullif(trim(coalesce(p_method,'')),''),
         reference = nullif(trim(coalesce(p_reference,'')),''),
         status = p_status,
         paid_at = p_paid_at
   where id = p_payment_id and club_id = v_club_id
   returning * into v_new;

  insert into public.audit_logs(actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()), 'update', 'payment', p_payment_id,
    jsonb_build_object(
      'before', jsonb_build_object(
        'athlete_id',v_old.athlete_id,'concept',v_old.concept,
        'concept_label',v_old.concept_label,'plan_id',v_old.plan_id,
        'payment_concept_id',v_old.payment_concept_id,'amount',v_old.amount,
        'method',v_old.method,'reference',v_old.reference,
        'status',v_old.status,'paid_at',v_old.paid_at
      ),
      'after', jsonb_build_object(
        'athlete_id',v_new.athlete_id,'concept',v_new.concept,
        'concept_label',v_new.concept_label,'plan_id',v_new.plan_id,
        'payment_concept_id',v_new.payment_concept_id,'amount',v_new.amount,
        'method',v_new.method,'reference',v_new.reference,
        'status',v_new.status,'paid_at',v_new.paid_at
      )
    )
  );
  return true;
end;
$function$;

revoke all on function public.update_payment_admin_v3(
  uuid, uuid, public.payment_concept, numeric, text, text,
  public.payment_status, timestamptz, uuid, uuid, text
) from public, anon;
grant execute on function public.update_payment_admin_v3(
  uuid, uuid, public.payment_concept, numeric, text, text,
  public.payment_status, timestamptz, uuid, uuid, text
) to authenticated;

revoke all on function private.sync_payment_plan_concept() from public, anon, authenticated;
notify pgrst, 'reload schema';
