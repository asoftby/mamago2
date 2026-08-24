# Phase 2F — product pricing UNKNOWN review

Read-only review from the local canonical database and immutable Phoenix snapshots. Live URLs were not fetched. Legacy numeric fields on still-`UNKNOWN` rows are shown as their actual persisted min/max and are not treated as normalized semantics.

| Entity | ID | Slug | Existing evidence | Current mode/min/max | Proposed mode/min/max | Reason | Confidence |
|---|---|---|---|---|---|---|---|
| Activity | `cmrrljj8c0006wsls2fw3jnyw` | `letniy-klub-dlya-detey-na-angliyskom` | No current or historical price evidence | UNKNOWN/null/null | UNKNOWN/null/null | Absence alone does not prove FREE or NONE | High |
| Activity | `cmrsduuwv0006wsepv9dbf19s` | `letnyaya-aktivnaya-razvlekatelnaya-zagorodnaya-programma-2026-aktiv-polis-na-baze-sanatoriya` | Date-sensitive early-booking ladder: 2213 BYN before 01.02.2026; later totals 2273/2348/2423 | UNKNOWN/null/null | UNKNOWN/null/null | Historical promotion is expired; component totals do not prove a current price | High |
| Activity | `cmrt4gvoz0006wse4r8c9nj4b` | — | No price evidence; slug absent | UNKNOWN/null/null | UNKNOWN/null/null | No evidence distinguishing NONE from missing data | High |
| Offer | `cmrwf27x80006ws2shcxrzcry` | `bomba` | No price fields or snapshot price evidence | UNKNOWN/null/null | UNKNOWN/null/null | Offer normally has price intent, but none is recoverable | High |
| Offer | `cmrwf2d350006ws4umryrklyv` | `disko-pati-maksi` | Expired 520 instead of 590 through 31.08.2025; legacy `priceFrom`/average-check 590 | UNKNOWN/590/null | UNKNOWN/null/null | Rule forbids deriving the current price from an expired promotion | High |
| Offer | `cmrwh34h40006ws8a7xo94o1c` | `paket-1-3-chasa` | `750 руб.`; legacy `priceFrom` and average-check both 750 | UNKNOWN/750/null | EXACT/750/750 | One explicit current amount without “от” | High |
| Offer | `cmrwh35780006ws8hglv7npyy` | `paket-neon-3-chasa` | `800 руб.`; legacy `priceFrom` and average-check both 800 | UNKNOWN/800/null | EXACT/800/800 | One explicit current amount without “от” | High |
| Offer | `cmrwf2dtj0006ws51hu9xed02` | `disko-pati-vip` | Expired 590 instead of 690 through 31.08.2025; legacy `priceFrom`/average-check 690 | UNKNOWN/690/null | UNKNOWN/null/null | Rule forbids deriving the current price from an expired promotion | High |
| Offer | `cmrwf2cci0006ws4nuthv7ih1` | `disko-pati` | Expired 440 instead of 490 through 31.08.2025; legacy `priceFrom`/average-check 440 | UNKNOWN/440/null | UNKNOWN/null/null | Both stored numbers are promotion-derived and do not prove a current price | High |
| Offer | `cmrwh3a9m0006wsam75f7tsdu` | `paket-3` | `380 руб.`; legacy `priceFrom` and average-check both 380 | UNKNOWN/380/null | EXACT/380/380 | One explicit current amount without “от” | High |
| Offer | `cmrwhrjwy0006wsg31srt6pum` | `semeynoe-kafe-tri-pingvina` | Legacy `priceFrom=350` and `average-check-program=350`; no price text/unit/mode | UNKNOWN/350/null | UNKNOWN/null/null | Average check does not distinguish EXACT from FROM | Medium |
| Place | `cmrq83p1h006owswv8en7xatk` | `mousse-kids-muss-kids` | Unresolved `visit-price=10451,10452` only | UNKNOWN/null/null | UNKNOWN/null/null | Relation IDs do not resolve to local structured evidence | High |
| Place | `cmrq83p27007qwswv9l4prtir` | `dva-kota` | “10 безлимитных посещений – 150 рублей”; unresolved relation IDs also present | UNKNOWN/null/null | EXACT/150/150 | One explicit current subscription amount | High |
| Place | `cmrq83p2l0089wswvxl8ks2ac` | `penguin-pingvin` | Current tariff table: trial/single/subscription/add-on prices from 22 to 4340 BYN | UNKNOWN/null/null | RANGE/22/4340 | Multiple explicitly current tariffs; 22 BYN is the standalone “+ ЗАЛ” add-on | High |
| Place | `cmrq83p5h00cpwswvotfuosjd` | `simba-simba` | Unresolved `visit-price=11420,11421` only | UNKNOWN/null/null | UNKNOWN/null/null | Relation IDs do not resolve locally | High |
| Place | `cmrq83pae00kewswvnimo75x3` | `aktiv-park` | Unresolved `visit-price=42758,42759,54132` only | UNKNOWN/null/null | UNKNOWN/null/null | Relation IDs do not resolve locally | High |
| Place | `cmrq83p3l009uwswvzex11pcj` | `trapetsiya` | Current climb/visit/training/subscription tariffs from 6 to 1200 BYN | UNKNOWN/null/null | RANGE/6/1200 | Multiple explicitly current tariffs | High |
| Place | `cmrq83p5400c6wswvioml1ulq` | `disco-park-disko-park` | Describes hourly visits and fixed packages, but contains no amounts; unresolved relation IDs | UNKNOWN/null/null | UNKNOWN/null/null | Product has own prices, but values cannot be recovered | High |
| Place | `cmrq83p9j00j6wswvd0p7zygh` | `igray-igray-na-kuprevicha` | Three current per-person packages: 35, 45, 55 BYN | UNKNOWN/null/null | RANGE/35/55 | Multiple explicitly current tariffs | High |
| Place | `cmrq83pch00nawswvm7fghwyh` | — | Current lesson tariffs: 29, 39, 45, 49, 55 BYN | UNKNOWN/null/null | RANGE/29/55 | Multiple explicitly current tariffs | High |
| Place | `cmrq83p2y008swswvko9zfc0i` | `golf-park-gol-f-park` | Describes hourly entry/rental but no amounts; unresolved IDs plus URL | UNKNOWN/null/null | UNKNOWN/null/null | URL must not be fetched and IDs do not resolve locally | High |
| Place | `cmrq83p39009bwswvw2p70cad` | `byuro-detektivnykh-kvestov-pinkerton` | URL-only price evidence | UNKNOWN/null/null | UNKNOWN/null/null | Live URL lookup is explicitly prohibited | High |

## Proposed decision set

- Apply after owner approval: 4 EXACT, 4 RANGE.
- Remain UNKNOWN: 14.
- No row is proposed as FREE, FROM, or NONE from the available evidence.
- The five `local-test-*` Activity fixtures are outside this table and must remain untouched.
