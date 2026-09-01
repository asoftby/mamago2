# Phase 2A — Owner Review Queue

These 5 URLs could not be automatically classified because their
geographic scope or semantic destination is ambiguous from the
available evidence. Each needs a short owner decision to proceed.

---

## Batch 1: Non-Minsk City Scope (2 articles)

These articles were redirected to `/minsk/blog/` but their content
is about non-Minsk locations. The current redirect destination is
wrong. Two options for each:

**Option A**: Change geoScope to `COUNTRY`, redirect to `/blog/{slug}`
(removes city scope, article appears nationally).

**Option B**: Change geoScope to the correct city if that city has
content infrastructure (likely not available yet).

| # | Legacy URL | Clicks | Title/Location | Decision needed |
|---|---|---|---|---|
| 1 | `/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome` | 1,114 | "Любимые места в Гродно и окрестностях" — places in Grodno (different city) | **COUNTRY or Grodno city?** If no Grodno city scope → COUNTRY. |
| 2 | `/akvapark-v-molodechno-i-vkusnjushhshhshhie-burgery` | 719 | "Аквапарк в Молодечно" — aquapark in Molodechno (~40km, not Minsk) | **COUNTRY or Molodechno city?** If no Molodechno scope → COUNTRY. |

> **Strong recommendation**: Classify both as `COUNTRY` since no other
> city scopes are active yet. This is the safest path: the article
> appears nationally at `/blog/{slug}` and is accessible from any city.
>
> If owner chooses COUNTRY, the redirect destination must be updated
> from `/minsk/blog/{slug}` to `/blog/{slug}` in wp-redirect-map.json.

---

## Batch 2: Ambiguous Geographic Scope (1 article)

| # | Legacy URL | Clicks | Title | Evidence | Decision needed |
|---|---|---|---|---|---|
| 3 | `/ekotropy` | 456 | "Экотропы" (Eco-trails) | Generic topic — could be Minsk eco-trails (CITY) or national eco-trails (COUNTRY). No geographic signal in slug. | **CITY or COUNTRY?** If article lists specific Minsk-trails → CITY. If generic list across Belarus → COUNTRY. |

---

## Batch 3: Event Semantic Destination (2 entries)

These are events where the current redirect maps to `/minsk/events/{slug}`
but the event is expired and the slug doesn't clearly map to a 2026 edition.

| # | Legacy URL | Clicks | Old Intent | Decision needed |
|---|---|---|---|---|
| 4 | `/events/festival-lidbeer-2025-lidbir` | 4,587 | Lidbeer 2025 festival. Check if Lidbeer 2026 exists. If yes → redirect to 2026 edition. If no → **redirect to `/minsk/events`**. | **Does Lidbeer 2026 exist? Check DB/production.** |
| 5 | `/events/detskaja-zheleznaja-doroga-raspisanie` | 1,497 | Children's railway schedule. This is a venue/attraction (not a single event). Check if a dedicated Place page exists. If yes → redirect to the Place. If not → redirect to `/minsk/events`. | **Is there a Place page for Children's Railway?** |

---

## Summary

| Batch | Count | Clicks | Recommended default |
|---|---|---|---|
| Non-Minsk cities (COUNTRY default) | 2 | 1,833 | Reclassify as COUNTRY, update redirect to `/blog/{slug}` |
| Ambiguous scope (ekotropy) | 1 | 456 | Reclassify as COUNTRY if no Minsk-only signal |
| Event destinations | 2 | 6,084 | Redirect to `/minsk/events` if no 2026 edition exists |
| **Total** | **5** | **8,373** | |

**Note**: These 5 URLs represent ~8,373 of the ~104,243 P2-A click mass
(~8%). The remaining 47 URLs are all `READY_AUTOMATED` or `READY_WITH_EXACT_MAPPING`
and can proceed independently of these decisions.