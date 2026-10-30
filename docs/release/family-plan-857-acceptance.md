# My Plan family identity — release acceptance #857

The current code uses active FamilyMembership and User.displayName to resolve each adult, and PlanItem.userId is the creator (different from PlanItem.assigneeUserId). Only server-authorized plan items are exposed; the participant and visibility filters in the browser can narrow those results, not grant access.

## Code checks before DEV
- FamilyPlanAcl PostgreSQL test must confirm two named adults, authorName from actual user account, PRIVATE isolation, legacy FROM_JOIN and revoked membership.
- Filter test must confirm both include/exclude and a stale removed user selection do not reveal or silently expand entries.
- PlanMainContent and PlanPageClient must reuse one atomic filter preference per authenticated user.
- No second recurrence service or migration.

## DEV checks before PROD
- Two real accounts with active accepted FamilyInvite and consent; if an account's User.displayName is blank, request a profile name from that account. Do not infer names from email or leak identifiers.
- Both accounts see the correct real name, creator and assigned participant on shared entries, and cannot see the other's PRIVATE entries.
- Invite acceptance, revoked/left member, legacy entries, multi-select/exclusions, navigation persistence, page and widget, Safari and Telegram Mini App.
- Fix any failing path before marking #857 VERIFIED / PROD-ready. GitHub merge is not proof of deployed behavior.
