# ClubOS — Incident response playbook

## Objective
Contain incidents, preserve evidence, restore trusted service and meet applicable contractual/legal notification duties. Notification timelines require legal review; do not assume one universal statutory deadline.

## Severity
- SEV-1 Critical: confirmed cross-tenant exposure, privileged credential compromise, destructive database access or widespread compromise.
- SEV-2 High: unauthorized access to sensitive records, multi-user exploit or material outage.
- SEV-3 Moderate: isolated account compromise, suspicious privileged action or contained vulnerability without exploitation evidence.
- SEV-4 Low: policy deviation or low-impact defect.

## First response
1. Open a restricted incident record; record UTC detection time, reporter, systems and severity.
2. Assign incident commander, technical lead, communications lead and privacy/legal contact.
3. Preserve GitHub Actions, Supabase Auth/Postgres/Storage logs, audit records, commits and timestamps. Restrict evidence access; never copy athlete/minor data into tickets.
4. Contain: rotate compromised credentials, suspend affected accounts/sessions, restrict exposed Storage objects and block vulnerable releases. Preserve evidence before destructive cleanup.
5. Determine affected clubs/users, data categories, time window, access path and whether data was viewed, changed, exported or deleted.
6. Eradicate root cause; deploy reviewed fix; run regression and tenant-isolation tests.
7. Recover from verified backups when required; validate integrity and tenant boundaries before cutover.
8. Assess contractual, privacy and legal notification duties with counsel and processors.
9. Close with timeline, impact, root cause, evidence links, corrective actions, owners and due dates.

## Scenario runbooks

### Privileged key exposure
Identify whether the key is publishable or privileged. Publishable Supabase keys are intended for browser use. Immediately rotate any service-role/secret key; update provider secret stores and redeploy. Search repository history, CI logs and artifacts; review database/Storage logs. Deleting a commit does not invalidate a leaked key.

### Suspected cross-tenant access
Preserve request, database and audit logs. Apply a narrowly scoped mitigation after impact review. Test read/insert/update/delete isolation using two independent test tenants. Identify affected records and escalate privacy review.

### Account compromise
Suspend the account and revoke sessions/tokens through the identity provider. Review MFA, sign-in history, role changes, exports and privileged actions. Restore access only after identity verification and credential reset.

### Availability or destructive event
Preserve logs and current database state. Confirm backup integrity and recovery point; restore to an isolated target where possible. Validate tenant boundaries and critical workflows before cutover.

## Post-incident
Complete a blameless review within 10 business days after containment. Record lessons, control gaps, risk acceptance, owners and deadlines; track actions to closure.
