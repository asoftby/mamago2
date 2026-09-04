# Phase 2A — Owner Review Queue

These 36 URLs cannot currently proceed automatically because their
geographic scope or semantic destination is ambiguous from the
available evidence. Each needs a short owner decision to proceed.

Two otherwise classifiable articles still lack exact target Article IDs in
the committed migration geography audits. They remain blocked until those
IDs are independently audited; slug lookup is not an acceptable substitute.

---

## Batch 0: Missing Audited Target ID (2 articles)

| Legacy URL | Clicks | Decision needed |
|---|---:|---|
| `/ivan-kupala-2025-ili-gde-otmetit-kupale-v-minske` | 12,535 | Audit and commit the exact target Article ID before automated recovery. |
| `/kuda-shodit-14-go-fevralya-raznym-tipam-parochek` | 1,033 | Audit and commit the exact target Article ID before automated recovery. |

Do not resolve these rows with `findFirst({ slug })`: unscoped Article slugs
are not guaranteed unique, so the wrong row could be published.

---

## Resolved 2026-09-04: Grodno regional article

`/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome`
(1,114 historical clicks) is no longer owner-review blocked.

The exact audited PROD article is `cmssu87vb00jews3fk0gbskm1`. PROD has no
Grodno `City` row, while `region_grodnenskaya_oblast` exists and belongs to
Belarus. The article explicitly covers Grodno and its surroundings.

**Owner/product decision:** restore it as `REGION` → `Гродненская область`.
The canonical public path is `/blog/{slug}`. A dedicated fail-closed
REGION-aware repair is required; the generic Phase 2A CITY/COUNTRY batch must
not apply this row. The legacy `/minsk/blog/{slug}` redirect is corrected to
`/blog/{slug}`.

---

## Batch 1: Non-Minsk City Scope (1 article)

The remaining article was redirected to `/minsk/blog/` but its content is
about a non-Minsk location. The current redirect destination is wrong.

**Option A**: Change geoScope to `COUNTRY`, redirect to `/blog/{slug}`
(removes city scope, article appears nationally).

**Option B**: Change geoScope to the correct city if that city has
content infrastructure.

| # | Legacy URL | Clicks | Title/Location | Decision needed |
|---|---|---:|---|---|
| 1 | `/akvapark-v-molodechno-i-vkusnjushhshhshhie-burgery` | 719 | "Аквапарк в Молодечно" — aquapark in Molodechno (~40km, not Minsk) | **COUNTRY or Molodechno city?** If no Molodechno scope → COUNTRY. |

> **Recommendation for the remaining Molodechno row**: use `COUNTRY` if no
> Molodechno content scope is available. If COUNTRY is chosen, update the
> redirect from `/minsk/blog/{slug}` to `/blog/{slug}`.

---

## Batch 2: Ambiguous Geographic Scope (4 articles)

| # | Legacy URL | Clicks | Title | Evidence | Decision needed |
|---|---|---:|---|---|---|
| 3 | `/ekotropy` | 456 | "Экотропы" (Eco-trails) | Generic topic — could be Minsk eco-trails (CITY) or national eco-trails (COUNTRY). No geographic signal in slug. | **CITY or COUNTRY?** If article lists specific Minsk-trails → CITY. If generic list across Belarus → COUNTRY. |
| 4 | `/besedki-dlya-dnya-rozhdeniya-na-prirode` | 743 | Birthday gazebos guide | Committed geography audit is `UNCLEAR`; redirect destination is not evidence. | **CITY or COUNTRY after content review?** |
| 5 | `/leto-2026-zagorodnyy-i-gorodskoy-otdyh-dlya-detey` | 537 | City and out-of-town summer recreation | Committed geography audit is `UNCLEAR` due mixed coverage. | **CITY or COUNTRY after content review?** |
| 6 | `/gde-ostavit-rebenka-s-nyaney` | 523 | Generic nanny guide | Committed geography audit is `UNCLEAR`; insufficient city evidence. | **CITY or COUNTRY after content review?** |

---

## Batch 3: Event Semantic Destination (3 entries)

These are events where the current redirect maps to `/minsk/events/{slug}`
but the event is expired and the slug doesn't clearly map to a 2026 edition.

| # | Legacy URL | Clicks | Old Intent | Decision needed |
|---|---|---:|---|---|
| 4 | `/events/festival-lidbeer-2025-lidbir` | 4,587 | Lidbeer 2025 festival. | If an exact current equivalent exists, use a semantic redirect. Otherwise choose historical restoration, a genuinely equivalent target, or `410_GONE` after owner review. |
| 5 | `/events/detskaja-zheleznaja-doroga-raspisanie` | 1,497 | Children's railway schedule. This is a venue/attraction, not a generic event intent. | If an exact Place/current entity exists, use it. Otherwise choose historical restoration, a genuinely equivalent target, or `410_GONE` after owner review. |
| 6 | `/events/bolshaya-kosmicheskaya-vystavka-kosmopark` | 3,447 | Past single-edition exhibition at Kosmopark. | Find an exact current equivalent, restore historical content, or decide `410_GONE`; do not use the generic event hub. |

A generic `/minsk/events` hub is **not** a semantic equivalent and must not be recommended as a fallback. No `410_GONE` decision is automated.

---

## Batch 4: Recurring/Seasonal Rows Without Exact Targets (20 entries)

These rows describe conditional work such as “use the 2026 edition if it
exists,” but the matrix does not record a concrete replacement entity and
canonical path. All 20 remain `BLOCKED_OWNER_REVIEW` until exact mappings are
committed. A current detail URL or generic event hub is not an exact mapping.

---

## Summary

| Batch | Count | Clicks | Recommended default |
|---|---:|---:|---|
| Missing audited target ID | 2 | 13,568 | Keep blocked until exact IDs are audited |
| Non-Minsk cities (COUNTRY default) | 1 | 719 | Reclassify as COUNTRY, update redirect to `/blog/{slug}` |
| Ambiguous scope | 4 | 2,259 | Keep blocked pending content-based geography decision |
| Event destinations | 9 | 14,193 | Exact equivalent only; otherwise retain owner review |
| Recurring/seasonal without exact target | 20 | 24,647 | Commit exact replacement entity/path before readiness |
| **Total** | **36** | **55,386** | |

**Note**: The remaining 16 URLs are `READY_AUTOMATED` or
`READY_WITH_EXACT_MAPPING` and can proceed independently of these decisions.
