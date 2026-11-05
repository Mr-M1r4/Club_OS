-- Restrict payment edits to club owners/admins and keep an audit trail.
-- The RPC is SECURITY INVOKER: RLS remains in force for both payments and audit_logs.

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
for update to authenticated
using (club_id = private.current_club_id() and private.current_role() in ('owner','admin'))
with check (club_id = private.current_club_id() and private.current_role() in ('owner','admin'));

create or replace function public.update_payment_admin(
  p_payment_id uuid,
  p_athlete_id uuid,
  p_concept public.payment_concept,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_status public.payment_status,
  p_paid_at timestamptz
) returns boolean
language plpgsql
set search_path = ''
as $function$
declare
  v_club_id uuid := private.current_club_id();
  v_old public.payments;
  v_new public.payments;
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
  select * into v_old from public.payments
  where id = p_payment_id and club_id = v_club_id
  for update;
  if not found then raise exception 'Pago no encontrado en el club activo'; end if;

  update public.payments
  set athlete_id = p_athlete_id,
      concept = p_concept,
      amount = p_amount,
      method = nullif(trim(coalesce(p_method,'')),''),
      reference = nullif(trim(coalesce(p_reference,'')),''),
      status = p_status,
      paid_at = p_paid_at
  where id = p_payment_id and club_id = v_club_id
  returning * into v_new;

  insert into public.audit_logs(actor_id,action,entity,entity_id,details)
  values (
    (select auth.uid()), 'update', 'payment', p_payment_id,
    jsonb_build_object(
      'before', jsonb_build_object('athlete_id',v_old.athlete_id,'concept',v_old.concept,'amount',v_old.amount,'method',v_old.method,'reference',v_old.reference,'status',v_old.status,'paid_at',v_old.paid_at),
      'after', jsonb_build_object('athlete_id',v_new.athlete_id,'concept',v_new.concept,'amount',v_new.amount,'method',v_new.method,'reference',v_new.reference,'status',v_new.status,'paid_at',v_new.paid_at)
    )
  );
  return true;
end;
$function$;

revoke all on function public.update_payment_admin(uuid,uuid,public.payment_concept,numeric,text,text,public.payment_status,timestamptz) from public, anon;
grant execute on function public.update_payment_admin(uuid,uuid,public.payment_concept,numeric,text,text,public.payment_status,timestamptz) to authenticated;
notify pgrst, 'reload schema';
