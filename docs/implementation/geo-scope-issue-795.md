# Geo scope implementation — Issue #795

Status: implementation preparation, not released.

## Confirmed behavior
- **Global header city selector**: explicitly changes the active catalog city and persists the visitor's chosen territory. Family home city is unaffected.
- **Other cities chips at the bottom of events listing**: temporary, events-only exploration of that city and its oblast. Do not persist the destination as the global browsing city. Other catalog sections continue in the previously chosen global city.
- **Family Plan** is city-agnostic: saving an event from another city does not switch the global or home city.
- Normal local discovery: selected city and its oblast. Cross-region candidates require geo-targeted promotion, editorial exception, or at least 50 distinct target-region families with active Plan additions; threshold grants eligibility, not rank.

## Existing code audit (dev, 2026-10-27)
- `src/contexts/CityContext.tsx`: `resolveCityContext` prioritizes URL route city; the synchronization effect writes resolved route city to `mg_territory` cookie. `setCity` writes cookie and navigates to `/slug`.
- `src/lib/city/resolveCityContext.ts`: precedence is route city > query/stored preference > default.
- **Bug risk**: a plain link from Minsk events to `/grodno/events` currently looks like a global city change because route city is persisted.

## Implementation checklist
- [ ] Locate existing bottom-of-feed other-city UI and all routes/links it generates.
- [ ] Introduce an explicit distinction between **temporary events browsing** and **persisted global city selection**; route URL should still accurately represent the events' actual city.
- [ ] Keep header selector displaying the persisted global city during temporary events exploration; show a separate local label for the destination city.
- [ ] Do not persist a route city merely because it was visited via a temporary exploration link. Ensure explicit header selection still persists and updates the entire catalog.
- [ ] Verify SSR hydration and direct deep links; design explicit fallback for a fresh visitor with no persisted global city.
- [ ] Tests: Minsk -> Grodno events chip -> header remains Minsk -> places remain Minsk; Grodno event can be added to Plan; header Grodno selection -> all catalog sections Grodno; direct deep links do not change family home city.
- [ ] Implement city+oblast event inclusion, then Boost geo-targeting, then 50-family eligibility in separate PRs, per Issue #795.
- [ ] CI and manual DEV verification before merge; no PROD changes without explicit approval.

## Product caution
The old cookie behavior may be relied on elsewhere. Avoid disabling route-to-cookie synchronization globally without inspecting callers and SSR behavior. Use a clearly scoped transition mechanism rather than an ambiguous query flag that can leak across sections.
