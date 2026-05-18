# Notification Unread Bootstrap Fix

Date: 2026-05-18
Scope: gating unread-count bootstrap by visible notification badge surface
Method: code-path update only; no notification UI redesign, no endpoint contract changes

## What was happening before

Unread bootstrap logic lived in `NotificationStoreAuthSync` and was designed to refresh unread counts as soon as an authenticated surface hydrated.

That meant the unread-count path could initialize too high in the tree:

- before the notifications panel/feed was opened
- before it was clear which badge stream was actually visible
- on surfaces where no visible bell/badge existed

The expensive part was not the feed itself, but the background bootstrap hit to `/api/notifications/unread-count`.

## What changed

Unread bootstrap is now mounted only from explicit badge-bearing surfaces via `NotificationSurfaceBootstrap`.

Bootstrap entry points are now:

- public surface: [src/app/(public)/PublicLayoutBody.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/(public)/PublicLayoutBody.tsx)
- business surface: [src/components/business/layout/BusinessShell.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/business/layout/BusinessShell.tsx)
- admin surface: [src/app/admin/layout.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/admin/layout.tsx)

Stream selection is now badge-aware instead of pathname-only:

- public desktop: follows the visible header bell stream (`user` or `business`, matching account mode)
- public mobile: boots only when the mobile bottom bar is present, and only for the visible `user` bell
- business shell: follows the visible business header bell stream (`business` by default, `user` in personal mode)
- admin: boots only the `user` unread stream

The sync layer now accepts an explicit unread stream and no longer guesses from global surface state alone.

## Surfaces with visible badge

- Public desktop header bell
- Public mobile bottom-nav bell
- Business header bell
- Admin header bell

## Surfaces that no longer bootstrap unread-count

- Guest public pages
- Public mobile routes where the bottom notification bar is hidden
- Any route tree outside the explicit public/business/admin badge shells
- Any mounted surface where no visible badge stream resolves to `user` or `business`

## Feed behavior

The full notifications feed remains lazy:

- `/api/notifications` still loads from `openPanel()`
- opening the bell/panel remains the first feed hydration point
- mark-open logic remains store-driven and untouched in this phase

## Route internals deferred

This phase does not slim `/api/notifications/unread-count` itself.

Still deferred:

- reducing auth/audience/Telegram work inside the unread-count route
- any per-user caching strategy
- any feed payload or notification system redesign

## Residual risks

- Public desktop/mobile badge visibility still depends on runtime viewport detection, so bootstrap intentionally waits for a client-side viewport resolution before choosing a stream.
- Legacy `notifications-changed` bridge consumers still exist; this phase narrows them to unread refresh instead of broad app-wide bootstrap.
- `/notifications` and `/business/notifications` are legacy redirect routes today, so there is no separate page-level unread preload path to preserve beyond the existing shell bells.
