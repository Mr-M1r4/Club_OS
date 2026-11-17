-- ClubOS portable club backup. Operational records only: never exports auth users,
-- platform admins, club memberships, audit logs, or ClubOS SaaS billing.
create or replace function public.export_club_data_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_club_id uuid := private.current_club_id();
  v_role text := private.current_role();
  v_table text;
  v_tables jsonb := '{}'::jsonb;
  v_result jsonb;
  v_allowed text[] := array[
    'categories','staff_members','teams','athletes','payment_concepts',
    'membership_plans','products','product_variants','training_sessions',
    'memberships','registrations','payments','sales','sale_items',
    'staff_payments','attendance','inventory_movements','events',
    'club_settings','notifications'
  ];
begin
  if v_club_id is null or v_role not in ('owner','admin') then
    raise exception 'Solo propietarios y administradores pueden exportar los datos del club';
  end if;

  foreach v_table in array v_allowed loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) order by t.id), ''[]''::jsonb)
         from public.%I t where t.club_id = $1',
      v_table
    ) into v_result using v_club_id;
    v_tables := v_tables || jsonb_build_object(v_table, coalesce(v_result, '[]'::jsonb));
  end loop;

  return jsonb_build_object(
    'format','clubos-backup',
    'version',1,
    'exported_at',now(),
    'source_club_id',v_club_id,
    'tables',v_tables
  );
end;
$function$;

create or replace function public.import_club_data_v1(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_club_id uuid := private.current_club_id();
  v_role text := private.current_role();
  v_table text;
  v_row jsonb;
  v_allowed text[] := array[
    'categories','staff_members','teams','athletes','payment_concepts',
    'membership_plans','products','product_variants','training_sessions',
    'memberships','registrations','payments','sales','sale_items',
    'staff_payments','attendance','inventory_movements','events',
    'club_settings','notifications'
  ];
  v_order text[] := array[
    'categories','staff_members','teams','athletes','payment_concepts',
    'membership_plans','products','product_variants','training_sessions',
    'memberships','registrations','payments','sales','sale_items',
    'staff_payments','attendance','inventory_movements','events',
    'club_settings','notifications'
  ];
  v_conflict boolean;
  v_inserted integer;
  v_total integer := 0;
  v_skipped integer := 0;
  v_payload jsonb;
  v_club_name text;
begin
  if v_club_id is null or v_role not in ('owner','admin') then
    raise exception 'Solo propietarios y administradores pueden importar datos';
  end if;
  if jsonb_typeof(p_backup) is distinct from 'object'
     or p_backup->>'format' is distinct from 'clubos-backup'
     or p_backup->>'version' is distinct from '1'
     or jsonb_typeof(p_backup->'tables') is distinct from 'object' then
    raise exception 'Archivo de respaldo ClubOS inválido o versión no compatible';
  end if;

  select name into v_club_name from public.clubs where id=v_club_id;

  -- Reject unknown tables rather than silently trusting uploaded content.
  if exists (
    select 1
      from jsonb_object_keys(p_backup->'tables') as x(key)
     where not (x.key = any(v_allowed))
  ) then
    raise exception 'El respaldo contiene tablas no permitidas';
  end if;

  foreach v_table in array v_order loop
    if not (p_backup->'tables' ? v_table) then continue; end if;
    if jsonb_typeof(p_backup->'tables'->v_table) is distinct from 'array' then
      raise exception 'La sección % debe ser una lista', v_table;
    end if;

    for v_row in select value from jsonb_array_elements(p_backup->'tables'->v_table) loop
      if jsonb_typeof(v_row) <> 'object' or nullif(v_row->>'id','') is null then
        raise exception 'Registro inválido en la sección %', v_table;
      end if;

      -- Never let a backup overwrite another club's row. Matching IDs already
      -- present in the destination are treated as idempotent skips.
      execute format(
        'select exists(select 1 from public.%I where id = $1 and club_id is distinct from $2)',
        v_table
      ) into v_conflict using (v_row->>'id')::uuid, v_club_id;
      if v_conflict then
        raise exception 'Conflicto de identificador en la tabla %; no se importó ningún dato', v_table;
      end if;

      -- A destination's existing club settings always win; importing a backup
      -- must not replace its branding or configuration.
      if v_table = 'club_settings' and exists (
        select 1 from public.club_settings where club_id = v_club_id
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_payload := (v_row - 'club_id' - 'updated_by' - 'created_by')
                   || jsonb_build_object('club_id',v_club_id);
      if v_table = 'club_settings' then
        v_payload := jsonb_set(v_payload,'{club_name}',to_jsonb(v_club_name),true);
        v_payload := v_payload - 'logo_path';
      elsif v_table = 'products' then
        v_payload := v_payload - 'image_path';
      end if;

      execute format(
        'insert into public.%I select (jsonb_populate_record(null::public.%I, $1)).*
         on conflict (id) do nothing',
        v_table, v_table
      ) using v_payload;

      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then
        v_total := v_total + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'imported',v_total,
    'skipped_existing',v_skipped,
    'destination_club_id',v_club_id,
    'mode','additive_no_overwrite'
  );
end;
$function$;

revoke all on function public.export_club_data_v1() from public, anon;
revoke all on function public.import_club_data_v1(jsonb) from public, anon;
grant execute on function public.export_club_data_v1() to authenticated;
grant execute on function public.import_club_data_v1(jsonb) to authenticated;

comment on function public.export_club_data_v1() is
'Exports club operational data only. Excludes auth identities, memberships, audit logs, and ClubOS SaaS billing.';
comment on function public.import_club_data_v1(jsonb) is
'Atomic additive restore into current club. Never overwrites existing rows or imports ClubOS SaaS billing.';
