# Provider Deduplication Fix

Date: 2026-05-18
Scope: Phase 1 runtime fix for duplicated provider mounts on the public surface

## What was duplicated

On public pages, these providers/components were mounted both in [src/app/layout.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/layout.tsx) and in the public tree:

- `CityProvider`
- `WeatherProvider`
- `FamilyPersonaProvider`
- `CookieConsentProvider`
- `PendingActionProvider`
- `MyPlanProvider`
- `FamilyDerivedAgeSync`
- `GateFlowController`
- `MobileTapDiagnostics`

Additionally:

- `UnreadNotificationCountProvider` existed only in public and was not duplicated.
- `NotificationStoreAuthSync` lives in [src/components/providers/GlobalProviders.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/GlobalProviders.tsx), but `GlobalProviders` is not mounted in the active app tree, so there was no live duplicate to remove in this phase.

## What stays in root/global

These remain in [src/app/layout.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/layout.tsx) because they are app-wide or needed for auth/gate behavior across surfaces:

- `SaveIntentProvider`
- `AuthProvider`
- `PendingActionProvider`
- `AccountModeProvider`
- `GateFlowController`
- `MobileTapDiagnostics`
- `Sonner`

## What stays in public

These now live only in [src/components/providers/PublicProviders.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/PublicProviders.tsx) and/or [src/app/(public)/layout.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/(public)/layout.tsx):

- `UnreadNotificationCountProvider`
- `CityProvider`
- `WeatherProvider`
- `FamilyPersonaProvider`
- `CookieConsentProvider`
- `FamilyDerivedAgeSync`
- `MyPlanProvider`

## Risks checked

- Auth hydration is preserved because `AuthProvider initialUser={await getCurrentAuthState()}` stays in root.
- Pending auth actions are preserved because `PendingActionProvider` and `GateFlowController` stay mounted globally.
- Public header still has `CityProvider`, `WeatherProvider`, and `FamilyPersonaProvider` through `PublicProviders`.
- Cookie consent loaders still exist on the public surface and are no longer double-mounted there.
- `MyPlanProvider` now mounts once on public pages instead of once in root and once in public.
- `FamilyPersonaProvider` now mounts once on public pages, which removes the main double-`/api/children` risk identified in the audit.
