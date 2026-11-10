# B2B cabinet — first visual consistency pass (2026-11-10)

## Source of truth
Use `/business/bookings` as the reference for B2B pages: the `BusinessShell`
provides navigation and page width; each section uses
`BusinessSectionHeader` (eyebrow, title, description, optional actions),
`space-y-6` page rhythm, white surfaces with neutral stone borders,
rounded corners, and consistent filter/empty/loading states.

This applies to the B2B interface only. The personal profile is not a
visual source of truth for business pages.

## Checked routes and current disposition

| Route | State at initial audit | Action |
| --- | --- | --- |
| `/business/bookings` | Reference (BusinessSectionHeader) | Keep |
| `/business/direct` | Redirected to personal profile | Separate fix PR #1221 |
| `/business/booking-units` | Shared section header | Keep |
| `/business/analytics` | Shared section header | Keep |
| `/business/publications/events` | Shared section header | Keep |
| `/business/publications/places` | Shared section header | Keep |
| `/business/team` | Shared section header inside client | Keep; inspect component states |
| `/business/notifications` | Standalone page width + duplicate header in NotificationCenter | Use shared header, embed existing center |
| `/business/reviews` | Standalone heading and square cards | Shared header, consistent radius/borders |
| `/business/support` | Component-owned title/max-width/padding | Shared header, optional embedded mode |
| `/business/billing` | Standalone balance title card | Shared header; retain balance flows |
| `/business/dashboard` | Customized dashboard structure | Follow-up: compare main header and cards |
| `/business/settings` | Generic renderSettingsPage | Follow-up: verify scope-specific wrapper |
| Other billing, promotion, publication editor detail routes | Not yet fully reviewed | Follow-up: inventory all nested pages |

## Review requirements before rollout

- Width and spacing against Bookings on desktop and 390/320 px mobile.
- Page titles, business navigation, responsive tables, filter and tab states.
- Empty/loading/error states, keyboard focus and sticky elements.
- Customer-facing /me notifications and shared SupportInbox callers must retain
  their existing headers/width.
- Business booking, billing, review replies and support ticket API behavior
  must remain unchanged.
- Capture before/after screenshots on DEV; do not infer visual pass from typecheck.

## Work boundaries
This is a first pass. Do not remove specialized components or duplicate-looking
styles without proving no other route uses them. Continue in small PRs under #1222.
