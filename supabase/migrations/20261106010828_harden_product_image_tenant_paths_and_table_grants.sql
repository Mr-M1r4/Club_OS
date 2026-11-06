-- Scope product-image writes to the owning club. Keep public reads for existing
-- product URLs and new images, but prevent cross-club overwrite/deletion.
drop policy if exists product_images_insert on storage.objects;
drop policy if exists product_images_update on storage.objects;
drop policy if exists product_images_delete on storage.objects;

create policy product_images_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select private.current_club_id())::text
  and (storage.foldername(name))[2] = 'products'
  and (select private.current_role()) in ('owner'::public.user_role, 'admin'::public.user_role, 'staff'::public.user_role)
);

create policy product_images_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select private.current_club_id())::text
  and (storage.foldername(name))[2] = 'products'
  and (select private.current_role()) in ('owner'::public.user_role, 'admin'::public.user_role, 'staff'::public.user_role)
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select private.current_club_id())::text
  and (storage.foldername(name))[2] = 'products'
  and (select private.current_role()) in ('owner'::public.user_role, 'admin'::public.user_role, 'staff'::public.user_role)
);

create policy product_images_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = (select private.current_club_id())::text
  and (storage.foldername(name))[2] = 'products'
  and (select private.current_role()) in ('owner'::public.user_role, 'admin'::public.user_role, 'staff'::public.user_role)
);

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

notify pgrst, 'reload schema';
