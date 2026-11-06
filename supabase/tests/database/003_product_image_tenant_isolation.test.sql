-- Regression tests for product-image tenant isolation and least-privilege grants.
begin;
select plan(3);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'product_images_insert'
      and with_check like '%storage.foldername(name)%'
      and with_check like '%private.current_club_id()%'
  ),
  'product image uploads are restricted to the active club folder'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'product_images_delete'
      and qual like '%storage.foldername(name)%'
      and qual like '%private.current_club_id()%'
  ),
  'product image deletion is restricted to the active club folder'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  ),
  'anonymous and authenticated roles have no dangerous table privileges'
);

select * from finish();
rollback;
