-- Preserve the payment category enum while linking custom membership plans.
-- Existing payments remain valid and keep their original concept values.

alter table public.payments
  add column if not exists plan_id uuid,
  add column if not exists concept_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_plan_id_fkey'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_plan_id_fkey
      foreign key (plan_id)
      references public.membership_plans(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists payments_club_plan_idx
  on public.payments (club_id, plan_id)
  where plan_id is not null;

-- The plan name is a payment-time snapshot: renaming or archiving a plan
-- must never rewrite the description of an already-issued payment.
create or replace function private.sync_payment_plan_concept()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_plan public.membership_plans%rowtype;
begin
  if new.plan_id is null then
    -- A plan FK's ON DELETE SET NULL leaves concept_label unchanged. Preserve
    -- that historical snapshot. An explicit edit clears it by sending NULL.
    if tg_op = 'UPDATE'
       and new.concept_label is not distinct from old.concept_label then
      new.concept_label := old.concept_label;
    else
      new.concept_label := null;
    end if;
    return new;
  end if;

  select *
    into v_plan
    from public.membership_plans
   where id = new.plan_id;

  if not found then
    raise exception 'El plan seleccionado no existe';
  end if;

  if v_plan.club_id is distinct from new.club_id then
    raise exception 'El plan no pertenece al club activo';
  end if;

  if tg_op = 'INSERT' or old.plan_id is distinct from new.plan_id then
    if not v_plan.active then
      raise exception 'No se pueden registrar pagos con un plan archivado';
    end if;
    new.concept_label := v_plan.name;
  elsif tg_op = 'UPDATE' then
    new.concept_label := old.concept_label;
  end if;

  -- The enum remains the stable reporting category; plan_id and the
  -- immutable label carry the selected service's identity.
  new.concept := 'membership'::public.payment_concept;
  return new;
end;
$function$;

drop trigger if exists payments_sync_plan_concept on public.payments;
create trigger payments_sync_plan_concept
before insert or update of plan_id, concept_label, concept, club_id
on public.payments
for each row
execute function private.sync_payment_plan_concept();

revoke all on function private.sync_payment_plan_concept() from public, anon, authenticated;

-- Dedicated versioned RPC keeps the existing update_payment_admin contract
-- available to older clients while allowing the current app to update plan
-- references atomically with the rest of the payment.
create or replace function public.update_payment_admin_v2(
  p_payment_id uuid,
  p_athlete_id uuid,
  p_concept public.payment_concept,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_status public.payment_status,
  p_paid_at timestamptz,
  p_plan_id uuid,
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
begin
  if (select private.current_role()) not in ('owner','admin') then
    raise exception 'Solo administradores y propietarios pueden editar pagos';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'El valor del pago debe ser cero o mayor';
  end if;

  if p_athlete_id is not null and not exists (
    select 1
      from public.athletes
     where id = p_athlete_id
       and club_id = v_club_id
  ) then
    raise exception 'El deportista no pertenece al club activo';
  end if;

  select *
    into v_old
    from public.payments
   where id = p_payment_id
     and club_id = v_club_id
   for update;

  if not found then
    raise exception 'Pago no encontrado en el club activo';
  end if;

  if p_plan_id is not null then
    select *
      into v_plan
      from public.membership_plans
     where id = p_plan_id
       and club_id = v_club_id;

    if not found then
      raise exception 'El plan no pertenece al club activo';
    end if;

    if not v_plan.active and p_plan_id is distinct from v_old.plan_id then
      raise exception 'No se puede asignar un plan archivado a otro pago';
    end if;
  end if;

  update public.payments
     set athlete_id = p_athlete_id,
         concept = case when p_plan_id is not null
                        then 'membership'::public.payment_concept
                        else p_concept end,
         plan_id = p_plan_id,
         concept_label = p_concept_label,
         amount = p_amount,
         method = nullif(trim(coalesce(p_method,'')),''),
         reference = nullif(trim(coalesce(p_reference,'')),''),
         status = p_status,
         paid_at = p_paid_at
   where id = p_payment_id
     and club_id = v_club_id
   returning * into v_new;

  insert into public.audit_logs(actor_id,action,entity,entity_id,details)
  values (
    (select auth.uid()),
    'update',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'before', jsonb_build_object(
        'athlete_id',v_old.athlete_id,
        'concept',v_old.concept,
        'concept_label',v_old.concept_label,
        'plan_id',v_old.plan_id,
        'amount',v_old.amount,
        'method',v_old.method,
        'reference',v_old.reference,
        'status',v_old.status,
        'paid_at',v_old.paid_at
      ),
      'after', jsonb_build_object(
        'athlete_id',v_new.athlete_id,
        'concept',v_new.concept,
        'concept_label',v_new.concept_label,
        'plan_id',v_new.plan_id,
        'amount',v_new.amount,
        'method',v_new.method,
        'reference',v_new.reference,
        'status',v_new.status,
        'paid_at',v_new.paid_at
      )
    )
  );

  return true;
end;
$function$;

revoke all on function public.update_payment_admin_v2(
  uuid, uuid, public.payment_concept, numeric, text, text,
  public.payment_status, timestamptz, uuid, text
) from public, anon;
grant execute on function public.update_payment_admin_v2(
  uuid, uuid, public.payment_concept, numeric, text, text,
  public.payment_status, timestamptz, uuid, text
) to authenticated;

notify pgrst, 'reload schema';
