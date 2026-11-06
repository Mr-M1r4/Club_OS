# ClubOS — Security & compliance control register

Purpose: engineering baseline mapped to SOC 2 Trust Services Criteria and ISO/IEC 27001:2022. This is not an audit opinion, certification, Statement of Applicability or claim of compliance.

System boundary: Next.js static frontend on GitHub Pages; Supabase Auth, Postgres and Storage; GitHub source control and Actions. Providers' assurance reports cover provider controls only. ClubOS remains responsible for application configuration, identities, data, authorization, vendor oversight and evidence.

## Technical baseline observed 2026-11-01

| Control | Evidence | State / action |
|---|---|---|
| Tenant isolation | RLS enabled on all inspected public tables; tenant-aware helpers and policies exist | Baseline present; add automated cross-tenant negative tests and review every new table |
| Privileged RPC | Five SECURITY DEFINER functions surfaced by Supabase Advisor; inspected functions check auth.uid() and roles/membership, and use empty search_path | Compensating checks present; retain narrow EXECUTE grants and test negative paths |
| Compromised passwords | Supabase Advisor reports leaked-password protection disabled | OPEN: enable in Supabase Auth and verify |
| MFA | No evidence of org-wide MFA enforcement available from repo inspection | OPEN: require MFA for privileged GitHub/Supabase accounts and assess app-level enforcement |
| CI integrity | Lockfile present but manifest drift detected | Manifest and lockfile synchronized; CI now uses npm ci and npm audit |
| CI permissions | Prior workflow had broad defaults and npm install | Explicit job permissions, read-only verification, separate deploy permissions, checkout credentials disabled |
| Secrets | Browser uses Supabase publishable key | Keep publishable key in Actions variables; privileged secrets only in provider secret stores; rotate exposed privileged keys |
| Logging | audit_logs table exists; provider logs available | OPEN: define retention, alerting, access review and evidence exports |
| Backup/restore | Managed backups depend on Supabase plan/configuration | OPEN: document RPO/RTO and complete a restore test |
| Vulnerability mgmt | npm audit gate and Dependabot configuration | Review findings and patch to defined SLAs |
| Incident response | Playbook in docs/INCIDENT-RESPONSE.md | OPEN: assign incident commander and run tabletop |
| Change mgmt | Build/migration CI exists | OPEN: protect main, require peer approval and passing checks in GitHub settings |

## Required operational controls
1. Identity: named accounts, MFA for privileged identities, least privilege, quarterly access review and immediate offboarding.
2. Authorization: RLS on every exposed table; tenant key on every tenant-owned row; policies check identity and active membership; UPDATE uses USING and WITH CHECK; test cross-tenant read/write denial.
3. Privileged database code: SECURITY INVOKER by default. SECURITY DEFINER requires documented need, fixed search_path, schema-qualified names, auth.uid validation, role checks, narrow EXECUTE grants, code review and negative tests.
4. Secrets: no service-role/secret keys in browser bundles, NEXT_PUBLIC variables, source control or logs. Store privileged keys in provider secret stores and rotate on exposure.
5. Secure delivery: lockfile installs, dependency/code scanning, protected branches, mandatory reviews, least-privilege workflow tokens and third-party Actions pinned by full commit SHA before production-grade assurance.
6. Data lifecycle: classify data; minimize collection; document purpose and lawful basis; define retention/deletion; restrict exports; protect athlete/minor data; maintain processor agreements and data-subject request procedures.
7. Operations: monitor Auth, database, Storage and deployments; alert on privileged changes and repeated failures; retain evidence under a documented schedule; test backups and incident response.
8. Suppliers: collect current SOC reports, ISO certificates, DPAs, subprocessors, breach terms and data residency details for GitHub, Supabase and other processors.

## SOC 2 / ISO 27001:2022 indicative mapping

| Domain | SOC 2 criteria | ISO Annex A | Evidence |
|---|---|---|---|
| Governance and risk | CC1-CC3 | 5.1-5.8 | Policies, risk register, ownership, management review |
| Identity and access | CC6 | 5.15-5.18, 8.2-8.5 | MFA reports, access reviews, joiner/mover/leaver records |
| Secure development | CC5, CC8 | 8.25-8.32 | PR approvals, CI logs, dependency scans, release records |
| Data protection | CC6, C1 | 5.12-5.14, 8.10-8.12, 8.24 | Data inventory, retention, encryption and deletion evidence |
| Logging and monitoring | CC7 | 8.15-8.16 | Alert records, log reviews, investigations |
| Incident management | CC7 | 5.24-5.28, 6.8 | Incident register, tabletop, lessons learned |
| Availability and recovery | A1 | 5.29-5.30, 8.13-8.14 | Backup config, restore test, RTO/RPO results |
| Supplier management | CC9 | 5.19-5.23 | Vendor register, DPAs, assurance reports, reviews |
| Compliance | CC1-CC2 | 5.31-5.36 | Legal register, audit evidence, corrective actions |

## Audit-readiness gates
- [ ] MFA enforced for privileged accounts and verified.
- [ ] Leaked-password protection enabled and verified.
- [ ] Advisor findings triaged with evidence.
- [ ] RLS negative tests prove tenant A cannot access tenant B.
- [ ] Every SECURITY DEFINER function has documented purpose, authorization tests and minimal grants.
- [ ] Protected main branch requires review and passing CI.
- [ ] Third-party Actions pinned to immutable full commit SHAs.
- [ ] Secret scanning enabled; no privileged key in history or artifacts.
- [ ] Backup restore test completed; RPO/RTO approved.
- [ ] Incident tabletop completed; notification contacts/timelines documented.
- [ ] Data inventory, retention/deletion, privacy notice and processor agreements approved.
- [ ] Risk assessment, Statement of Applicability, internal audit and management review completed.

## Review cadence
Continuous CI/advisories; monthly vulnerability, incident and backup review; quarterly access recertification and vendor/risk review; annual policy, restore and incident exercises.

## Platform version note

The linked production Supabase project was observed on PostgreSQL 17.6.1.166 (2026-11-01). Supabase announced PostgreSQL 17.11 minor updates on 2026-09-25 that address 44 CVEs. Treat the managed database upgrade as a high-priority platform maintenance item: review Supabase release notes, extension/index impact and maintenance window, confirm backup/PITR coverage, then upgrade through the Supabase dashboard and run smoke tests. This was not changed automatically because the managed upgrade can affect availability and indexes.

## Production hardening applied 2026-11-05

The following controls were implemented against the linked production project and mirrored in the security hardening branch:

- Tenant resolution now returns the active club only when the authenticated user has an active `club_memberships` row for that club, or is a platform administrator. This prevents a still-valid JWT from retaining tenant reads after an administrator disables that membership.
- Product image writes, updates and deletes now require the first object path segment to equal the active club ID and the second segment to be `products`. The frontend now uploads new images under `<club-id>/products/<uuid>.<ext>`. Existing public product image URLs remain readable; legacy unscoped objects are no longer mutable by ordinary club users.
- Revoked `TRUNCATE`, `TRIGGER` and `REFERENCES` table privileges from `anon` and `authenticated` on current public tables and from future tables created with the current default privileges.
- Hardened `admin-users` and `membership-reminders` Edge Functions: strict active-club authorization for user administration, bounded request bodies, validated action inputs, least-information error responses, no-store responses, and an explicit CORS origin allowlist. Both functions retain JWT verification.
- Added database regression tests for active membership resolution, RLS coverage, the security-invoker arrears view, product-image path isolation and dangerous table privileges.

Verification performed against production:
- PostgreSQL 17.6.1.166; all inspected public tables have RLS enabled.
- The `membership_arrears` view has `security_invoker=true`.
- A transaction-scoped negative test simulated disabling an active membership under an authenticated JWT. The active-club resolver returned NULL and the test user saw zero athlete rows; the transaction was rolled back.
- Product-image policies and grants were inspected after migration.
- Edge Functions were redeployed with JWT verification enabled.

Remaining operational items:
- Supabase Security Advisor still reports five authenticated-callable `SECURITY DEFINER` RPCs. These are intentional RPC entry points with explicit identity/role/club checks and fixed empty `search_path`; keep their negative authorization tests and review each code change. Do not switch them to SECURITY INVOKER without first redesigning the associated table permissions.
- Leaked-password protection remains OPEN. It must be enabled in Supabase Dashboard > Authentication > Settings > Password Security (availability depends on the Supabase plan); verify the Advisor clears after enabling.
- Organization/account MFA, app-level MFA enforcement, SSL/network restrictions, backup restore, GitHub branch protection, secret scanning and incident tabletop require separate account/operational verification.
- GitHub Pages cannot set arbitrary response headers. A strong HTTP response-header CSP/HSTS policy must be configured at a reverse proxy/custom host if required; do not claim these headers are enforced by GitHub Pages.
