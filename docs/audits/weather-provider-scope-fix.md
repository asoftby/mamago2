# Weather Provider Scope Fix

Date: 2026-05-18
Scope: remove eager public weather fetches and keep weather loading only near weather-aware UI
Method: code-path inspection, targeted runtime-provider changes, static verification with lint/typecheck/build

## Before

Before this change, `WeatherProvider` was mounted globally in [src/components/providers/PublicProviders.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/PublicProviders.tsx).

Because `PublicProviders` wraps the whole public group in [src/app/(public)/layout.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/(public)/layout.tsx), public page loads could eagerly trigger:

- `/api/weather/weekly?city=...`

That happened even on routes that do not render weather UI.

## Consumers found

Direct client weather consumers found during the audit:

- `useOptionalWeather()` in [src/features/hero-weather/ui/HeroGreeting.tsx](/Users/shapovalovalexey/dev/mamago2/src/features/hero-weather/ui/HeroGreeting.tsx)
- `useOptionalWeather()` in [src/features/my-plan/components/WeatherDisplay.tsx](/Users/shapovalovalexey/dev/mamago2/src/features/my-plan/components/WeatherDisplay.tsx)

Direct `useWeather()` consumers found:

- none

Direct `WeatherProvider` usages before the fix:

- [src/components/providers/PublicProviders.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/PublicProviders.tsx)

Other weather-related code found but not part of the public eager-fetch problem:

- server-side hero weather assembly in [src/features/hero-weather/lib/get-hero-context.ts](/Users/shapovalovalexey/dev/mamago2/src/features/hero-weather/lib/get-hero-context.ts)
- API route in [src/app/api/weather/weekly/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/weather/weekly/route.ts)

## Chosen approach

Chosen approach: local demand-scoped provider.

What changed:

- Removed global `WeatherProvider` from [src/components/providers/PublicProviders.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/PublicProviders.tsx)
- Added [src/components/providers/OptionalWeatherProvider.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/providers/OptionalWeatherProvider.tsx)
- Wrapped [src/features/hero-weather/ui/HeroGreetingShell.tsx](/Users/shapovalovalexey/dev/mamago2/src/features/hero-weather/ui/HeroGreetingShell.tsx) with `OptionalWeatherProvider`
- Wrapped [src/features/my-plan/components/WeatherDisplay.tsx](/Users/shapovalovalexey/dev/mamago2/src/features/my-plan/components/WeatherDisplay.tsx) with `OptionalWeatherProvider`
- Removed old pathname-based skip logic from [src/contexts/WeatherContext.tsx](/Users/shapovalovalexey/dev/mamago2/src/contexts/WeatherContext.tsx), because provider scope is now the main guardrail instead of route-prefix checks

Why this path was chosen:

- It is smaller and safer than moving provider wiring across many route segments.
- It keeps `CityProvider` untouched.
- It does not touch geo filters, notifications, or `MyPlanProvider`.
- It preserves existing weather cache and in-flight dedupe inside `WeatherContext`.

## What should stop calling `/api/weather/weekly`

After this change, pages without weather-aware UI should no longer mount `WeatherProvider` by default.

That includes the requested public routes, assuming they do not render local weather-aware components:

- `/minsk`
  - exception: city home still renders `HeroGreetingShell`, so weather can still load there by design
- `/minsk/events`
- `/minsk/events/[slug]`
- `/routes/[slug]`
- `/blog/[slug]`

Important nuance:

- The city home route that renders `HeroGreetingShell` remains weather-aware and can still load `/api/weather/weekly`.
- The other listed public detail/list pages no longer inherit weather fetching from the public root layout.

## Where weather should keep working

Weather support remains available where a known consumer mounts:

- `HeroGreetingShell` on city-home surfaces via [src/features/city-home/pages/CityHomePage.tsx](/Users/shapovalovalexey/dev/mamago2/src/features/city-home/pages/CityHomePage.tsx)
- `WeatherDisplay` if/when it is mounted in plan/day UI

Because `OptionalWeatherProvider` is local and reusable, a weather-aware component can still fetch weather without restoring a global public provider.

## API caching

[src/app/api/weather/weekly/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/weather/weekly/route.ts) now returns:

- `Cache-Control: public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600`

Response shape was not changed.

## Residual risks

- `HeroGreetingShell` is still a weather-aware client surface, so city home can still request `/api/weather/weekly`. This is intentional.
- `WeatherDisplay` was found as a consumer but not as an active routed usage during this audit. It is now self-scoped, so future mounts should work, but no active route-level browser verification was possible here.
- Browser-network verification for the exact requested URLs was not completed in this environment, so the no-request expectation is based on provider placement and consumer search rather than a captured live waterfall.

## Verification status

- `pnpm lint`: passed with pre-existing warnings only
- `pnpm exec tsc --noEmit`: passed
- `pnpm build`: could not be confirmed complete in this environment; it repeatedly reached `Creating an optimized production build ...` and then stopped producing output without a terminal success/failure line
