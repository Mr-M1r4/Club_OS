-- Keep uploads from the currently deployed frontend working during rollout.
-- This is INSERT-only compatibility: legacy root-level product images still
-- cannot be overwritten or deleted by club users.
drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (
    (
      (storage.foldername(name))[1] = (select private.current_club_id())::text
      and (storage.foldername(name))[2] = 'products'
    )
    or (
      (storage.foldername(name))[1] = 'products'
      and (storage.foldername(name))[2] is null
    )
  )
  and (select private.current_role()) in ('owner'::public.user_role, 'admin'::public.user_role, 'staff'::public.user_role)
);
notify pgrst, 'reload schema';
