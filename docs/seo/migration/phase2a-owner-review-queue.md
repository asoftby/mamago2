# Phase 2A — Owner Review Queue

These 7 URLs could not be automatically classified because their
geographic scope or semantic destination is ambiguous from the
available evidence. Each needs a short owner decision to proceed.

Two of the seven are otherwise classifiable articles whose exact target
Article IDs are absent from the committed migration geography audits. They
remain blocked until those IDs are independently audited; slug lookup is not
an acceptable substitute.

---

## Batch 0: Missing Audited Target ID (2 articles)

| Legacy URL | Clicks | Decision needed |
|---|---:|---|
| `/ivan-kupala-2025-ili-gde-otmetit-kupale-v-minske` | 12,535 | Audit and commit the exact target Article ID before automated recovery. |
| `/kuda-shodit-14-go-fevralya-raznym-tipam-parochek` | 1,033 | Audit and commit the exact target Article ID before automated recovery. |

Do not resolve these rows with `findFirst({ slug })`: unscoped Article slugs
are not guaranteed unique, so the wrong row could be published.

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
| 4 | `/events/festival-lidbeer-2025-lidbir` | 4,587 | Lidbeer 2025 festival. | If an exact current equivalent exists, use a semantic redirect. Otherwise choose historical restoration, a genuinely equivalent target, or `410_GONE` after owner review. |
| 5 | `/events/detskaja-zheleznaja-doroga-raspisanie` | 1,497 | Children's railway schedule. This is a venue/attraction, not a generic event intent. | If an exact Place/current entity exists, use it. Otherwise choose historical restoration, a genuinely equivalent target, or `410_GONE` after owner review. |

A generic `/minsk/events` hub is **not** a semantic equivalent and must not be recommended as a fallback. No `410_GONE` decision is automated.

---

## Summary

| Batch | Count | Clicks | Recommended default |
|---|---|---|---|
| Missing audited target ID | 2 | 13,568 | Keep blocked until exact IDs are audited |
| Non-Minsk cities (COUNTRY default) | 2 | 1,833 | Reclassify as COUNTRY, update redirect to `/blog/{slug}` |
| Ambiguous scope (ekotropy) | 1 | 456 | Reclassify as COUNTRY if no Minsk-only signal |
| Event destinations | 2 | 6,084 | Exact equivalent only; otherwise retain owner review |
| **Total** | **7** | **21,941** | |

**Note**: These 7 URLs represent ~21,941 of the ~104,243 P2-A click mass.
The remaining 45 URLs are all `READY_AUTOMATED` or `READY_WITH_EXACT_MAPPING`
and can proceed independently of these decisions.
