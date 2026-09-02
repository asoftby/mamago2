# P0 SEO Recovery — Phase 1B: article publication/geo recovery matrix

Date: 2026-08-31
Scope: the 9 migrated articles left `status=PENDING`, `geoScope=NULL`,
`cityId=NULL` after Phase 1 (PR #159, `ec136ba7`) corrected their legacy
redirect *slugs* but did not touch publication state or geography.

Source evidence:
- `docs/migration/reviews/article-geoscope-owner-review-2026-08-15.csv` /
  `.md` — prior editorial read of title/body/categories/tags/headings.
- `docs/migration/reviews/article-geoscope-source-2026-08-15.ndjson` — raw
  per-article extraction (headings, detected geographic names, body text)
  the owner-review was built from.
- `src/lib/seo/migratedArticleSlugRecovery.ts` — Phase 1's per-article
  legacy path / current slug / GSC click data.
- PROD (read-only) `Article` row check on 2026-08-31: confirms all 9 are
  `status=PENDING`, `geoScope=NULL`, `cityId=NULL`, `noindex=false`, with a
  historical `publishedAt` and non-null `contentJson` — matching the task
  background exactly.
- Minsk `City.id` = `cmq1fetfc003ioc0nkc4ekcro` (from
  `article-geoscope-auto-2026-08-15.csv`); the repair script resolves this
  by `slug: "minsk"` at runtime rather than hardcoding it.

Two articles were re-audited directly against their full body text/headings
in the source ndjson rather than taken at the prior owner-review's word,
per this task's explicit instructions:

- `cmssu3i7401gcwsobb2h2nsfn` — the 2026-08-15 owner review classified this
  `CITY_MINSK` (confidence MEDIUM) citing ГУМ/Коммунарка. Re-reading the
  full heading list shows two headings the prior review did not weigh:
  **"Роспись новогодних украшений в Мирском замке"** (Mir Castle, Karelichy
  district, Grodno region — ~100 km from Minsk, a different oblast) and
  **"Центр экотуризма «Станьково»"** (Stankovo, Dzyarzhynsk district —
  ~40 km from Minsk, a different district). This is a materially
  multi-region "where to go over winter break" listicle, not a Minsk-only
  one. Recommendation changed to **COUNTRY**.
- `cmssu30ek019kwsobf832vz78` — full body text audited for all 10 named
  parks (Актив Парк, DiscoPark, Golf Park, ИГRАЙ, «Мама, я сам. Ферма»,
  Usmile.by, Prizma Park, Мистерия, Скаут Парк, Neon Park). No addresses are
  given in-text and the automated geographic-name detector found nothing,
  but none of the ten venues carry any non-Minsk signal either — all are
  identifiable Minsk entertainment venues (one, «Мама, я сам. Ферма», is
  article `cmssu2p6p013swsob5sfq3dhv` in this same batch). Confirmed
  **CITY/minsk**, matching the prior review.

## Matrix

### 1. `cmsswy95w034ywsqhtdtya6t4` — ТОП-18 кафе и ресторанов с детской площадкой или комнатой

| field | value |
|---|---|
| currentSlug | `top-18-kafe-i-restoranov-s-detskoy-ploshchadkoy-ili-komnatoy` |
| legacyUrl | `/top-18-kafe-i-restoranov-s-detskoj-ploshhadkoj-ili-komnatoj` |
| historicalClicks | 8807 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-06-16 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | Body explicitly states scope "в пределах Минска и до 10 км от него" (within Minsk and up to 10 km from it); named Minsk cafes/restaurants. One outlier token ("Молодечно") in the auto geo-name scan is not corroborated by visible content and is outweighed by the article's own explicit radius statement. |
| recommendedGeoScope | **CITY** |
| recommendedCity | minsk |
| finalCanonicalPath | `/minsk/blog/top-18-kafe-i-restoranov-s-detskoy-ploshchadkoy-ili-komnatoy` |
| confidence | HIGH |
| reason | Explicit city+radius scope statement in the article body, corroborated by owner review. |

### 2. `cmsswyqze03amwsqhrkm0afc6` — 10 парков для активного отдыха и развлечений в Минске

| field | value |
|---|---|
| currentSlug | `10-parkov-dlja-aktivnogo-otdyha-i-razvlechenij-v-minske` |
| legacyUrl | `/10-parkov-dlya-aktivnogo-otdyha-i-razvlecheniy-v-minske` |
| historicalClicks | 4167 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-06-28 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | Title explicitly "в Минске"; named park listicle including Ratomka (a Minsk-district satellite consistently treated as in-scope elsewhere in this corpus). |
| recommendedGeoScope | **CITY** |
| recommendedCity | minsk |
| finalCanonicalPath | `/minsk/blog/10-parkov-dlja-aktivnogo-otdyha-i-razvlechenij-v-minske` |
| confidence | HIGH |
| reason | Title-explicit city scope, named local venues. |

### 3. `cmssu3til01k0wsobe87c51bg` — Новогодние фотозоны Минска 2025/2026

| field | value |
|---|---|
| currentSlug | `novogodnie-fotozony-minska-40-fotozon-i-40-idej-pochemu-stoit-tuda-shodit` |
| legacyUrl | `/novogodnie-fotozony-minska-40-fotozon-i-40-idey-pochemu-stoit-tuda-shodit` |
| historicalClicks | 3216 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-12-14 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | Title explicitly names Minsk; listicle of specific named local photo spots. |
| recommendedGeoScope | **CITY** |
| recommendedCity | minsk |
| finalCanonicalPath | `/minsk/blog/novogodnie-fotozony-minska-40-fotozon-i-40-idej-pochemu-stoit-tuda-shodit` |
| confidence | HIGH |
| reason | Title-explicit city scope, named local venues. |

### 4. `cmssu0ow1007cwsobcv282mvt` — Творческие, музыкальные и языковые кружки и секции для детей в Минске

| field | value |
|---|---|
| currentSlug | `tvorcheskie-muzykalnye-i-jazykovye-kruzhki-i-sekcii-dlja-detej-v-minske` |
| legacyUrl | `/tvorcheskie-muzykalnye-i-yazykovye-kruzhki-i-sekcii-dlya-detey-v-minske` |
| historicalClicks | 258 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-09 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | Curated list of real, named Minsk children's clubs/studios; title also explicitly says Минск. |
| recommendedGeoScope | **CITY** |
| recommendedCity | minsk |
| finalCanonicalPath | `/minsk/blog/tvorcheskie-muzykalnye-i-jazykovye-kruzhki-i-sekcii-dlja-detej-v-minske` |
| confidence | HIGH |
| reason | Title-explicit city scope, named local venues. |

### 5. `cmssu29u000xswsobs5591cis` — ТОП идей, что подарить маме на День матери

| field | value |
|---|---|
| currentSlug | `top-idej-chto-podarit-mame-na-den-materi-interesnye-i-originalnye-podarki-pro-jemocii` |
| legacyUrl | `/top-idey-chto-podarit-mame-na-den-materi-interesnye-i-originalnye-podarki-pro-emocii` |
| historicalClicks | 180 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-10-04 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | `detectedGeographicNames: []`; generic Mother's-Day gift-idea listicle with no city-specific framing or named local venues. |
| recommendedGeoScope | **COUNTRY** |
| recommendedCity | null |
| finalCanonicalPath | `/blog/top-idej-chto-podarit-mame-na-den-materi-interesnye-i-originalnye-podarki-pro-jemocii` |
| confidence | MEDIUM |
| reason | Absence of any geographic signal across two independent evidence passes; generic subject matter not tied to Minsk. |

### 6. `cmssu26ev00wcwsobwpy1glg0` — 4.8 млн.$ за первый детский сад «Северного берега»

| field | value |
|---|---|
| currentSlug | `4-8-mln-za-pervyj-detskij-sad-severnogo-berega` |
| legacyUrl | `/pervyy-detskiy-sad-severnogo-berega` |
| historicalClicks | 159 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-09-24 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | News item about a specific residential development ("Северный берег" / Severny Bereg) inside Minsk. Not caught by the generic toponym detector (it's a development brand name, not a classic place name), but unambiguous by content. |
| recommendedGeoScope | **CITY** |
| recommendedCity | minsk |
| finalCanonicalPath | `/minsk/blog/4-8-mln-za-pervyj-detskij-sad-severnogo-berega` |
| confidence | HIGH |
| reason | Named Minsk development, single-subject news item. |

### 7. `cmssu3i7401gcwsobb2h2nsfn` — Новогодний гайд: куда пойти на зимних каникулах и где отметить Новый год с детьми

| field | value |
|---|---|
| currentSlug | `novogodnij-gajd-kuda-pojti-na-zimnih-kanikulah-i-gde-otmetit-novyj-god-s-detmi` |
| legacyUrl | `/novogodniy-gayd-kuda-poyti-na-zimnih-kanikulah-i-gde-otmetit-novyy-god-s-detmi` |
| historicalClicks | 64 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-12-05 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | Re-audited full heading list (25 headings): includes "Роспись новогодних украшений в Мирском замке" (Mir Castle — different oblast, ~100 km away) and "Центр экотуризма «Станьково»" (~40 km away, different district), alongside genuinely Minsk-based venues (ГУМ, «Коммунарка»). Materially multi-region. |
| recommendedGeoScope | **COUNTRY** |
| recommendedCity | null |
| finalCanonicalPath | `/blog/novogodnij-gajd-kuda-pojti-na-zimnih-kanikulah-i-gde-otmetit-novyj-god-s-detmi` |
| confidence | HIGH |
| reason | Direct content re-audit found non-Minsk, cross-region venues; overrides the 2026-08-15 owner review's CITY_MINSK (MEDIUM) call per this task's explicit instruction to verify. |

### 8. `cmssu2p6p013swsob5sfq3dhv` — «Мама, я сам. Ферма» — лучшее место для всей семьи

| field | value |
|---|---|
| currentSlug | `mama-ja-sam-ferma-luchshee-mesto-dlja-vsej-semi` |
| legacyUrl | `/mama-ya-sam-ferma` |
| historicalClicks | 25 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-10-24 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | Opening announcement for a named venue at "Лебяжий" (Lebyazhy recreation zone), within Minsk city. |
| recommendedGeoScope | **CITY** |
| recommendedCity | minsk |
| finalCanonicalPath | `/minsk/blog/mama-ja-sam-ferma-luchshee-mesto-dlja-vsej-semi` |
| confidence | HIGH |
| reason | Single named venue, confirmed in-Minsk location. |

### 9. `cmssu30ek019kwsobf832vz78` — Где отметить день рождения в крытом парке: 10 классных парков развлечений для праздника

| field | value |
|---|---|
| currentSlug | `gde-otmetit-den-rozhdenija-v-krytom-parke-10-klassnyh-parkov-razvlechenij-dlja-prazdnika` |
| legacyUrl | `/gde-otmetit-den-rozhdeniya-v-krytom-parke-10-klassnyh-parkov-razvlecheniy-dlya-prazdnika` |
| historicalClicks | 11 |
| currentStatus / geoScope / cityId | PENDING / NULL / NULL |
| publishedAt | 2024-10-30 (historical, present) |
| contentBlocks | non-empty |
| migration geo evidence | Explicit per-venue audit of all 10 named parks (Актив Парк, DiscoPark, Golf Park, ИГRАЙ, «Мама, я сам. Ферма», Usmile.by, Prizma Park, Мистерия, Скаут Парк, Neon Park). No addresses given in-text; no non-Minsk geographic marker found for any venue; all identifiable as Minsk entertainment venues (one overlaps this same batch, article #8). |
| recommendedGeoScope | **CITY** |
| recommendedCity | minsk |
| finalCanonicalPath | `/minsk/blog/gde-otmetit-den-rozhdenija-v-krytom-parke-10-klassnyh-parkov-razvlechenij-dlja-prazdnika` |
| confidence | HIGH |
| reason | Full per-venue location audit found no multi-region signal; all venues Minsk-based. |

## Summary

- CITY/minsk: 7 (`cmsswy95w034ywsqhtdtya6t4`, `cmsswyqze03amwsqhrkm0afc6`, `cmssu3til01k0wsobe87c51bg`, `cmssu0ow1007cwsobcv282mvt`, `cmssu26ev00wcwsobwpy1glg0`, `cmssu2p6p013swsob5sfq3dhv`, `cmssu30ek019kwsobf832vz78`)
- COUNTRY/global: 2 (`cmssu29u000xswsobs5591cis`, `cmssu3i7401gcwsobb2h2nsfn`)
- Redirect targets changed from `/minsk/blog/{slug}` to `/blog/{slug}`: the same 2 COUNTRY articles (see `scripts/data/wp-redirect-map.json`).

## Known follow-up (out of scope for this repair, recorded not fixed)

Phase 1's `ArticleSlugHistory` rows for these 9 articles were created with
`cityId=NULL` (read from `Article.cityId` at the time, which was NULL for
all 9). This repair only ever changes `Article.status/geoScope/cityId` —
`ArticleSlugHistory` is intentionally left untouched, per this task's
explicit APPLY scope. After this repair, the 7 CITY articles' `Article.cityId`
will be Minsk's id while their existing `ArticleSlugHistory` rows keep
`cityId=NULL`. This only matters for a secondary path — a direct request to
`/minsk/blog/{old-prod-slug}` using the pre-Phase-1 slug variant, which is
not on the critical path validated by this task (the legacy WP URLs redirect
straight to the *current* slug via `manifest.csv`'s `wp_map` rows, never
through `ArticleSlugHistory`) — but it is a real latent gap worth a small
dedicated follow-up.
