---
name: mamago-design-system
description: Apply mamaGo 2.0 design tokens and reusable controls when creating or updating buttons, chips, badges, filters, inputs, forms, and mobile UI in the Next.js application.
---

# mamaGo Design System

Use this skill for ALL new or modified UI components, forms, buttons, chips, badges and filter controls. Start by reading `docs/design-system.md` and `src/app/globals.css`; check the DEV-only catalog at `/ui-lab`.

## Existing foundations (do not replace with a new library)

- Tailwind v4 semantic colors and radii live in `src/app/globals.css`.
- Base components live in `src/components/ui/`.
- Use `Button` for actions, `Input`/`Textarea` for text entry, `Badge` for non-interactive status, `Chip`/`ChipsRow` for choices.
- `PrimaryButton`, raw JSX controls, and literal Tailwind colors exist in legacy areas. Audit before migrating; do not wholesale replace.
- Keep `brand`, `primary`, `surface`, `border`, `danger`, `success` and `warning` semantics. Do not hardcode `#EF8759` or other accent hex values in new UI.
- A chip is selectable; a badge is informational. Don't make status badges look clickable without interaction.
- `rounded-full` is appropriate for pills; use radius tokens for regular controls and cards.
- Preserve current public, business, admin and wizard functionality.

## Workflow

1. Run `pnpm ui:design-audit` (read-only) and `pnpm ui:audit` (component usage inventory) on a clean task worktree.
2. Review the existing primitive and each call site; identify semantic state, variant, mobile sizing and keyboard behavior.
3. Implement or extend the canonical primitive before changing multiple consumers; preserve existing API compatibility unless a deliberate migration is approved.
4. Add the component and ALL applicable states to `src/app/(ui)/ui-lab/_sections/DesignSystemFoundationSection.tsx` or the relevant UI Lab catalog.
5. Verify 320px and 375px mobile widths and desktop; tap targets, horizontal scrolling, focus-visible, loading, disabled, selected, validation and error states.
6. For mobile text input, keep computed font size at least 16px to prevent iOS Safari input zoom. Never disable user zoom through viewport settings.
7. For scrollable chip/date rows, preserve touch scrolling, no accidental page overflow and visible selected/focus states.
8. Run relevant typecheck, lint, tests and visual regression checks; record any untested states in PR.
9. One feature group per PR. Do not merge, deploy, rewrite unrelated screens, or change PROD without explicit authorization.

## Acceptance criteria

- One canonical visual decision for each component state; documented exceptions only.
- Reusable semantic tokens, no new unexplained raw colors/sizes.
- Consistent spacing and radii within an approved component variant.
- Accessible label, keyboard handling, focus indicator, disabled treatment and error text where needed.
- Screenshots or explicit visual review from UI Lab before broad migration.
- CI rules should be introduced only AFTER the initial legacy inventory and migration baseline are reviewed; existing legacy patterns are findings, not build failures.

## Output on each UI task

Summarize affected components, original variations, token/variant choices, preserved exceptions, mobile/desktop checks, test results and whether UI Lab is updated.


## UI Lab 2.0 navigation and approval

- Unified internal review UI: `/ui-lab?tab=foundations|components|patterns|screens|admin|audit`, not the old public/admin catalogs as competing sources.
- `/ui-lab/preview` uses an actual iframe viewport at 320/375/768/1200 px. `/ui-lab/cards` and `/ui-lab/wizard` are linked detail previews.
- `src/lib/ui-lab/catalog.ts` records approval decisions (`draft`, `review`, `approved`, `legacy`). Do not mark a variant approved just because it renders or passes CI.
- The old admin lab is an archive, including historical text that describes itself as a source of truth. Treat that as obsolete.
- Every preview, legacy URL and embedded route must inherit `requireUiLabAccess`: only authenticated ADMIN/MODERATOR on non-production `APP_ENV`; never use `NODE_ENV` as the only DEV signal.
- Missing usage statistics mean `unknown`, not 0. Do not treat a stale registry as proof a component is unused.
