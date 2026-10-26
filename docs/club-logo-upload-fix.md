# ClubOS — Logo upload repair

## Problem
Club administrators can fail to upload or replace their club logo from **Configuración → Identidad del club**.

## Diagnosis
The logo uploader uses Supabase Storage `upload(..., { upsert: true })`. Replacing an existing object requires Storage `SELECT` permission in addition to `INSERT` and `UPDATE`. The original `club-logos` policies only defined insert/update/delete, so replacement could be rejected by row-level security.

## Repair
- Add a Storage `SELECT` policy scoped to the authenticated user's active club and owner/admin role.
- Preserve the existing 2 MB JPG/PNG/WebP restrictions and per-club object path.
- Show upload progress and actionable errors in the settings UI, reset the file input for retry, verify the settings row was updated, and invalidate cached logo URLs.

## Verification checklist
- [ ] Administrator uploads a new logo.
- [ ] Administrator replaces the existing logo.
- [ ] Logo remains visible after reload in the header and payment receipts.
- [ ] A club administrator cannot list or modify another club's logo objects.
- [ ] Invalid file types and files over 2 MB are rejected with a visible message.
- [ ] GitHub Actions build/deploy succeeds.

## Workspace
Branch: `fix/club-logo-upload`
