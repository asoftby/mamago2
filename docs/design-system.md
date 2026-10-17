# mamaGo 2.0 — Design System

**Status: foundation inventory, not yet a global visual migration.** Existing tokens and components remain in production until their consumers are audited and variants are approved. This document replaces outdated design-system color and radius examples.

## Principles

- Warm, editorial, family-friendly and clear, with restrained emphasis.
- Consistency is semantic, not visual uniformity: actionable buttons, selectable chips and informational badges are different things.
- Mobile first, keyboard-accessible, and comfortable for touch.
- All semantic colors, surfaces and radii derive from `src/app/globals.css`. Avoid introducing hardcoded HEX values in new UI.
- No page-specific global overrides to compensate for a shared component. Fix the primitive or create a documented variant.

## Existing source of truth

| Role | Token / primitive | Usage |
|---|---|---|
| Primary action | `bg-primary`, `text-primary-foreground`, `hover:bg-primary-hover` | Main CTA, save, publish |
| Editorial / brand accent | `brand`, `brand-soft`, `text-brand` | Selection, branded emphasis |
| Surface | `surface`, `surface-muted`, `surface-hover` | Input, card, muted and hover backgrounds |
| Borders | `border`, `border-strong` | Outlines and separators |
| Status | `success`, `warning`, `danger` | Positive, pending, destructive |
| Regular button radius | `--radius-button` | Currently 16px in globals.css; Button still uses `rounded-md` |
| Card radius | `--radius-card` | Currently 20px in globals.css |
| Typography | NT Somic UI; PT Serif for editorial headings | Follow current layout and typography components |
| Spacing | Tailwind spacing and documented semantic component variants | Avoid one-off magic values |

Do not copy the above colors as HEX: CSS tokens are canonical and may change.

## Controls: definitions and current differences

| Control | Purpose | Current implementation | Migration decision to review |
|---|---|---|---|
| `Button` | Action | `src/components/ui/button.tsx`; default `h-9`, `rounded-md` | Define approved `xs/sm/md/lg/icon` heights and radius |
| `PrimaryButton` | Legacy CTA wrapper | `src/components/ui/PrimaryButton.tsx`; auto height, 16px radius, custom padding | Migrate consumers to a named `Button` variant, preserving layout |
| `Chip` | Select one/multiple choices | `src/components/ui/Chip.tsx`; `h-9`, pill | Align selected/focus/disabled semantics with ChipsRow |
| `ChipsRow` | Group of choices; scroll, wrap or masonry | `src/components/ui/chips-row.tsx`; different sizes and legacy HEX colors | Shared choice primitive with layout-only variants; preserve horizontal scroll and age layouts |
| `Badge` | Non-interactive metadata/status | `src/components/ui/badge.tsx` | Keep it informational; never substitute for selectable Chip |
| `Input` / `Textarea` | Text entry | `src/components/ui/input.tsx` and `textarea.tsx` | Adopt common label, description, error, required, disabled states |
| `Toggle` | Boolean switch | `src/components/ui/Toggle.tsx`; selected state hardcodes brand HEX | Replace legacy literal with semantic token after reviewing variants |

This matrix describes current code, not an approved replacement for all button heights. Do not globally switch `rounded-md` to `rounded-[16px]` without screenshot review.

## Form contract

- Keep explicit labels, help text and inline validation errors. Required and disabled states must be distinguishable.
- Selected choices expose `aria-pressed` or appropriate radio/checkbox semantics; groups have accessible names.
- Do not set `user-scalable=no`. On iOS Safari, preserve a computed text-entry font size of at least 16px to prevent focus zoom.
- On mobile, test width 320px and 375px, keyboard focus, touch scrolling and clipping. Maintain comfortable tap areas (target 44x44px where practicable).
- Distinguish empty, placeholder, default, focus, selected, disabled, loading, invalid and success states.
- Preserve dates, prices, touch behaviors and existing business rules during visual migrations.

## Inventory and visual review

Run read-only audit:

```bash
pnpm ui:design-audit
pnpm ui:design-audit --json
pnpm ui:design-audit --out /tmp/mamago-ui-audit.md
node --test scripts/design-system-audit.test.mjs
```

`pnpm ui:audit` remains the separate import-usage scanner and writes its own usage data. The design-system audit does not write repository files by default, and findings are heuristic migration candidates, not guaranteed bugs.

The `/ui-lab` page (development only) contains **Design System — Foundation** with live button, chip, badge, field and state examples. Use it for desktop/mobile review and future screenshot baselines before migrating call sites.

## Rollout order

1. **Foundation PR:** collect exact inventory and expose live variants, document deviations, add Codex skill. No app-wide visual change or CI blocker.
2. **Tokens and components PR:** agree Button / PrimaryButton / Chip / ChipsRow / Input API and states, then implement backward-compatible changes.
3. **Public pages PRs:** migrate filters, discovery, cards and public forms by feature, checking screen diffs.
4. **Business and wizard PRs:** migrate B2B onboarding, offer/event/place wizard and date/price controls; separately check desktop and mobile.
5. **Admin and protection PRs:** migrate admin, collect visual baselines and introduce a gated lint/CI rule after existing debt is classified.

## Definition of done for each migration PR

Document the old and new variants, affected views, intentional exceptions, test results (types, lint and mobile/desktop visual), and updated UI Lab examples. Do not claim completion solely from string replacements or a green build.


## UI Lab 2.0 — unified approval environment

**URL:** `/ui-lab` on DEV with `APP_ENV=dev` (or local, staging, preview). The shared layout checks `getCurrentUser()` and permits ADMIN/MODERATOR only. `APP_ENV=production` and unknown environments fail closed; using only `NODE_ENV` would incorrectly block compiled DEV builds. The old `/ui-lab-admin` and its wizard route redirect into the unified lab and are guarded too.

The shared navigation uses query tabs:

- `?tab=foundations`: semantic colors, fonts, radii.
- `?tab=components`: live component variants plus real responsive iframe preview (320/375/768/1200).
- `?tab=patterns`: filter, modal, scheduling, form and wizard patterns.
- `?tab=screens`: page-scale examples and linked card states.
- `?tab=admin`: archived admin examples, **not** approved design standards.
- `?tab=audit`: searchable explicit approval registry and CI inventory links.

Preview routes `/ui-lab/preview`, `/ui-lab/cards` and `/ui-lab/wizard` inherit the same server-side access gate. Use `src/lib/ui-lab/catalog.ts` for the editorial status of each canonical component, not the rendering result or counts derived from stale metadata.

**Approval states:** draft → review → approved → legacy. No status is changed to approved solely because the code renders.

**Migration safeguards:** keep legacy sources and documentation until replacements are approved and their consumers migrated. The historical admin page contains deprecated colors and "single source of truth" notices: these are examples under review, not instructions to copy.

**Access verification:** test unauthenticated and non-admin sessions on DEV, an authenticated ADMIN session on DEV, and a request to the same path on PROD (must 404). Also verify the old admin and wizard URLs do not bypass access checks. For visual verification check iframe sizes, Safari focus zoom, keyboard navigation, selected and disabled states.

**Usage metadata:** `RenderSafe` must not invent 0 usages if the generated usage map is missing. Run `pnpm ui:audit` for source-import stats; the PR-level `Design System Inventory` action produces a separate read-only audit artifact.
