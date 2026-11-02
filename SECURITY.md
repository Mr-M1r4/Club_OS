# Security policy

ClubOS accepts vulnerability reports through GitHub private vulnerability reporting for this repository. Do not publish exploit details in public issues.

## Scope
- Authentication and authorization.
- Tenant isolation and Supabase Row Level Security.
- Database functions, views, Storage and Edge Functions.
- CI/CD, dependencies, secrets and deployment configuration.

## Reporting
Use the repository Security tab and select Report a vulnerability. Include the affected component, impact, reproduction steps and mitigation if known. Never include athlete/minor records, credentials, tokens or production data.

## Internal response targets
- Acknowledge within 3 business days.
- Triage severity within 5 business days.
- Remediation or mitigation plan based on severity and exploitability.

These are internal targets, not a service-level guarantee. Keep disclosure coordinated until mitigation is available.

## Credential exposure
Revoke or rotate exposed credentials at the issuing provider, assess access logs, invalidate affected sessions where appropriate, and document the incident. Supabase publishable keys are intended for browser use; service-role and secret keys must never enter browser code, NEXT_PUBLIC variables, commits or build artifacts.
