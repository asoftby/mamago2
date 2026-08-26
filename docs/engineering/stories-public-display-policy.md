# Public Stories display policy

Status: active product rule  
Updated: 2026-08-27

## Principle

The public Stories rail must describe what the user can expect after opening a circle. Internal classification slots are allowed to be more technical, but they must not leak misleading names into the homepage UI.

## Public circles

### Сегодня

This is the single temporal circle.

It combines:

- point events / occurrences that belong to the current civil day in the city timezone;
- serial programs from the internal `running` source only when they have an occurrence on the current day.

The public title is always `Сегодня`. The legacy `Идёт сейчас` wording is not a separate public circle and must not leak into the public viewer for these merged items.

### Бесплатно

Separate contextual circle for the next 7 civil days.

Eligibility is based on structured free-price semantics. It includes point/window inventory and serial free activities. The circle may overlap with `Сегодня`: this is intentional because it answers a different user question.

### Breaking news

Separate editorial circle only while there is actual eligible breaking-news content. No empty placeholder circle.

### Успеть

Reserved contextual circle. It remains hidden until a real `promoUntil` / last-chance signal is present in canonical inventory. Do not fabricate a surrogate from arbitrary event end dates.

## Internal-only / deferred slots

- `running`: internal serial-program source feeding `Сегодня`; not a public circle.
- `tomorrow`, `weekend`, `nextweek`: disabled. Current inventory does not support these slots consistently enough to justify public circles.
- `newplaces`: deferred until a real publication/freshness signal exists; `Place.createdAt` is polluted by migration/import timing and is not a trustworthy product signal.
- legacy `near`, `age_3_5`, `new`: type-level leftovers are not part of the canonical public Stories rail.

## Seen / unseen behavior

The existing client behavior remains:

- unseen circle: orange ring;
- all items seen: grey ring / subdued cover;
- badge shows the count of unique unseen stable content identities;
- opening a circle puts unseen items first and seen items after them;
- seen state is persisted locally in `mamago.stories.seen.v2`;
- the ring cover follows the first unseen item when one exists.

This behavior is independent of the public circle composition policy above.

## Correctness rules

- Serial representative occurrence selection must be deterministic: choose the earliest occurrence inside the applicable range, never depend on database row order.
- Public temporal language follows the city timezone and calendar day.
- Contextual circles may overlap `Сегодня`; temporal duplication as separate circles should not.
- Empty collections are not rendered.
