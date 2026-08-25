/**
 * Source-inspection guard for UserEvent taxonomy meta enrichment.
 *
 * PROD audit found 0% coverage of meta.categorySlug across all UserEvent —
 * producers never populated it, even where the taxonomy was already loaded
 * server-side (only the display label was selected, never the slug). This
 * locks the fix: EVENT/PLACE/ARTICLE DETAIL_OPEN + SAVE + PLAN_ADD producers
 * populate categorySlug from an already-loaded EventCategory relation, with
 * zero additional DB queries (existing selects widened, not new lookups).
 *
 * OFFER (Offer.category is the PartyCategory enum, not EventCategory) and
 * ROUTE (no taxonomy field in the schema) are deliberately NOT wired here —
 * asserted negatively below so nobody "completes" them by guessing.
 *
 * CARD_VIEW: enriched wherever categorySlug was zero-query-reachable —
 * ARTICLE producers (CityHomeContentRows, BlogIndex, the continuous
 * reader's article_impression) and EVENT (DiscoveryActivitiesGrid, fed by
 * the kuda feed / loadUpcomingPlaceEvents, both of which already `include`
 * eventCategory — only the nameRu label was selected before, slug was one
 * field away). ActivityMock gained one optional `eventCategorySlug` field;
 * only the one EVENT branch in DiscoveryActivitiesGrid's tracker reads it,
 * OFFER is explicitly forced to null there. The remaining OFFER CARD_VIEW
 * producers (CityHomeContentRows classes row, [city]/programs) stay
 * unenriched — Offer.category is PartyCategory, a different taxonomy
 * system — tracked in docs/engineering/backlog.md (BACKLOG-130).
 *
 * Run: pnpm exec tsx src/lib/analytics/taxonomyMetaEnrichment.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function main() {
  // --- contract: categorySlug is a first-class, documented meta field ---
  const types = source("src/lib/analytics/types.ts");
  assert.ok(
    /categorySlug\?:\s*string \| null/.test(types),
    "AnalyticsMetaPayload must declare categorySlug as a first-class field",
  );

  // --- EVENT: detail loader selects slug (zero extra query — same select) ---
  const eventLoader = source("src/lib/event/loadPublicActivityForCityPage.ts");
  assert.ok(
    eventLoader.includes("eventCategory: { select: { nameRu: true, slug: true } }"),
    "Event detail loader must select eventCategory.slug alongside the existing nameRu label",
  );
  const eventPageInputType = source("src/lib/event/buildEventPageDataFromPrisma.ts");
  assert.ok(
    eventPageInputType.includes("eventCategory: { nameRu: string; slug: string } | null"),
    "ActivityForEventPageInput must type eventCategory.slug",
  );
  const eventPage = source("src/app/(public)/[city]/events/[slugOrId]/page.tsx");
  assert.ok(
    eventPage.includes("meta={{ categorySlug: fromDb.eventCategory?.slug ?? null }}"),
    "Event detail page must pass eventCategory.slug into the DETAIL_OPEN beacon meta",
  );

  // --- PLACE: detail page selects primaryCategory.slug, not the legacy free-text field ---
  const placePage = source("src/app/(public)/[city]/places/[slug]/page.tsx");
  assert.ok(
    placePage.includes("primaryCategory: {\n        select: {\n          nameRu: true,\n          slug: true,\n        },\n      },"),
    "Place detail page must select primaryCategory.slug (the canonical EventCategory FK, not the legacy Place.category free-text field)",
  );
  assert.ok(
    placePage.includes("meta={{ categorySlug: place.primaryCategory?.slug ?? null }}"),
    "Place detail page must pass primaryCategory.slug into the DETAIL_OPEN beacon meta",
  );

  // --- ARTICLE: shared MVP loader selects category.slug once, used by both DETAIL_OPEN sites ---
  const articleLoader = source("src/lib/article/articleMvpRenderData.ts");
  assert.ok(
    articleLoader.includes("category: {\n    select: {\n      nameRu: true,\n      slug: true,\n    },\n  },"),
    "Article MVP select must include category.slug alongside nameRu",
  );
  assert.ok(
    (articleLoader.match(/categorySlug: article\.category\?\.slug \?\? null,/g) ?? [])
      .length === 2,
    "Both loadArticleMvpBySlugPublic and loadArticleMvpById must return categorySlug",
  );
  for (const path of [
    "src/app/(public)/[city]/blog/[slug]/page.tsx",
    "src/app/(public)/blog/[slug]/page.tsx",
  ]) {
    const s = source(path);
    const beaconCount = (s.match(/<AnalyticsDetailBeacon/g) ?? []).length;
    const withCategory = (
      s.match(/meta=\{\{ categorySlug: mvp\.categorySlug \}\}/g) ?? []
    ).length;
    assert.ok(
      withCategory >= 3,
      `${path}: expected at least 3 mvp-backed ARTICLE DETAIL_OPEN beacons to carry categorySlug, found ${withCategory} (of ${beaconCount} total beacons — a legacy non-mvp path is allowed to stay unenriched)`,
    );
  }

  // --- SAVE (idea route): EVENT/PLACE/ARTICLE carry categorySlug from an already-loaded entity ---
  const ideaRoute = source("src/app/api/save/idea/route.ts");
  assert.ok(
    ideaRoute.includes("category: { select: { slug: true } }"),
    "SAVE (article) must widen the existing article lookup to include category.slug",
  );
  assert.ok(
    ideaRoute.includes("primaryCategory: { select: { slug: true } }"),
    "SAVE (place) must widen the existing place lookup to include primaryCategory.slug",
  );
  assert.ok(
    ideaRoute.includes("categorySlug: article?.category?.slug ?? null,") &&
      ideaRoute.includes("categorySlug: place?.primaryCategory?.slug ?? null,") &&
      ideaRoute.includes("categorySlug: eventCategorySlug,"),
    "SAVE meta for ARTICLE/PLACE/EVENT must carry categorySlug",
  );

  // --- PLAN_ADD (plan route): PLACE/EVENT carry categorySlug ---
  const planRoute = source("src/app/api/save/plan/route.ts");
  assert.ok(
    planRoute.includes("primaryCategory: { select: { slug: true } }"),
    "PLAN_ADD (place) must widen the existing place lookup to include primaryCategory.slug",
  );
  assert.ok(
    planRoute.includes("categorySlug: place?.primaryCategory?.slug ?? null,") &&
      planRoute.includes("categorySlug: eventCategorySlug,"),
    "PLAN_ADD meta for PLACE/EVENT must carry categorySlug",
  );

  // --- shared EVENT lookup: one query returns both cityId and taxonomy (no new query) ---
  const activityCity = source("src/lib/analytics/activityCity.ts");
  assert.ok(
    activityCity.includes("eventCategory: { select: { slug: true } }") &&
      !/prisma\.activity\.findUnique[\s\S]*?prisma\.activity\.findUnique/.test(
        activityCity,
      ),
    "getActivityAnalyticsContext must fetch cityId and eventCategorySlug from a single Activity lookup",
  );

  // --- negative guards: no guessing for OFFER/ROUTE, no entityType-as-category leakage ---
  assert.ok(
    !/entityType\s*,?\s*\n?\s*categorySlug:\s*entityType/.test(ideaRoute) &&
      !ideaRoute.includes('categorySlug: "OFFER"') &&
      !ideaRoute.includes('categorySlug: entityType'),
    "No producer may synthesize categorySlug from entityType",
  );
  const offerSaveBlock = ideaRoute.slice(
    ideaRoute.indexOf('entityType: "OFFER"') - 400,
    ideaRoute.indexOf('entityType: "OFFER"') + 200,
  );
  assert.ok(
    !offerSaveBlock.includes("categorySlug"),
    "OFFER SAVE must not claim categorySlug — Offer.category is PartyCategory, a different taxonomy system than EventCategory",
  );
  const routePage = source("src/app/(public)/routes/[slug]/page.tsx");
  assert.ok(
    !routePage.includes("categorySlug"),
    "ROUTE has no EventCategory-compatible taxonomy field in the schema — must not claim categorySlug",
  );

  // --- ARTICLE CARD_VIEW: enriched wherever categorySlug was already zero-query-reachable ---
  const cityHomeRows = source(
    "src/features/city-home/components/CityHomeContentRows.tsx",
  );
  assert.ok(
    cityHomeRows.includes(
      'meta={{ section: "journal", position: index, categorySlug: a.category?.slug ?? null }}',
    ),
    "CityHomeContentRows ARTICLE CARD_VIEW must carry categorySlug (CityHomeJournalArticle already selects category.slug)",
  );
  const cityHomeOfferBlock = cityHomeRows.slice(
    cityHomeRows.indexOf('entityType="OFFER"') - 200,
    cityHomeRows.indexOf('entityType="OFFER"') + 300,
  );
  assert.ok(
    !cityHomeOfferBlock.includes("categorySlug"),
    "CityHomeContentRows OFFER (classes) CARD_VIEW must not claim categorySlug — feed DTO has no category field, and Offer.category is PartyCategory anyway",
  );

  const blogIndex = source("src/app/(public)/blog/BlogIndex.tsx");
  assert.ok(
    blogIndex.includes(
      'meta={{ section: "journal", position: "featured", categorySlug: featured.category?.slug ?? null }}',
    ) &&
      blogIndex.includes(
        "meta={{ section: \"journal\", position: i + 1, categorySlug: a.category?.slug ?? null }}",
      ),
    "BlogIndex featured + list ARTICLE CARD_VIEW must both carry categorySlug",
  );

  const continuousReader = source(
    "src/components/article/continuous/ContinuousArticleReader.tsx",
  );
  assert.ok(
    continuousReader.includes('data-article-category={seed.section?.slug ?? ""}') &&
      continuousReader.includes(
        'data-article-category={article.section?.slug ?? ""}',
      ),
    "ContinuousArticleReader must render categorySlug (via section.slug, already loaded) as a data attribute for both the seed and dynamically-loaded articles",
  );
  assert.ok(
    continuousReader.includes(
      'const categorySlug = entry.target.getAttribute("data-article-category") || null;',
    ) &&
      /analyticsRef\.current\.track\(\s*"article_impression",\s*id,\s*slug,\s*analyticsCtx\(id, pos, null\),\s*\{ categorySlug \},\s*\)/.test(
        continuousReader,
      ),
    "Continuous reader's article_impression (CARD_VIEW) must read categorySlug from the DOM and pass it through to the tracker",
  );

  // --- EVENT CARD_VIEW: DiscoveryActivitiesGrid, sourced from the kuda feed ---
  const activityType = source("src/types/activity.ts");
  assert.ok(
    /eventCategorySlug\?:\s*string \| null/.test(activityType),
    "ActivityMock must declare eventCategorySlug as an optional field (backward-compatible for the ~20 other consumers)",
  );
  const eventMapper = source("src/server/discovery/mapDiscoveryEventToActivityMock.ts");
  assert.ok(
    eventMapper.includes("eventCategory: { nameRu: string; slug: string } | null;") &&
      eventMapper.includes("eventCategorySlug: a.eventCategory?.slug ?? null,"),
    "mapDiscoveryEventToActivityMock must type and return eventCategory.slug from the row it already receives",
  );
  const kudaFeed = source("src/server/discovery/kudaDiscoveryFeed.ts");
  assert.ok(
    kudaFeed.includes("eventCategory: { select: { nameRu: true, slug: true } },"),
    "Kuda discovery feed must select eventCategory.slug alongside the existing nameRu label (same include, zero new query)",
  );
  const upcomingPlaceEvents = source("src/lib/place/loadUpcomingPlaceEvents.ts");
  assert.ok(
    upcomingPlaceEvents.includes("eventCategory: { select: { nameRu: true, slug: true } },"),
    "loadUpcomingPlaceEvents must select eventCategory.slug too, to keep the shared mapper's input type satisfied (same include, zero new query)",
  );

  const discoveryGrid = source("src/components/discovery/DiscoveryActivitiesGrid.tsx");
  assert.ok(
    /categorySlug:\s*\n\s*activity\.analyticsEntityType === "OFFER"\s*\n\s*\? null\s*\n\s*: \(activity\.eventCategorySlug \?\? null\)/.test(
      discoveryGrid,
    ),
    "DiscoveryActivitiesGrid must pass eventCategorySlug as categorySlug for EVENT cards, and explicitly null (never PartyCategory) for OFFER cards",
  );

  // --- negative guards for the remaining CARD_VIEW producers ---
  const programsPage = source("src/app/(public)/[city]/programs/page.tsx");
  assert.ok(
    !programsPage.includes("categorySlug"),
    "programs/page.tsx CARD_VIEW is OFFER (PartyCategory) — must not claim categorySlug",
  );
  const routeCard = source("src/components/routes/RouteCard.tsx");
  assert.ok(
    !routeCard.includes("categorySlug"),
    "RouteCard CARD_VIEW must not claim categorySlug — ROUTE has no taxonomy field",
  );
  const articleTelegramInvitation = source(
    "src/components/article/continuous/ArticleTelegramInvitation.tsx",
  );
  assert.ok(
    !articleTelegramInvitation.includes("categorySlug"),
    "ArticleTelegramInvitation's CARD_VIEW is a non-content impression (article_telegram_cta_impression) — structurally excluded from views/preferredCategories regardless of meta, left unenriched",
  );

  // --- canonical field guard: producers write categorySlug, not competing aliases ---
  for (const [label, s] of [
    ["idea route", ideaRoute],
    ["plan route", planRoute],
    ["event detail page", eventPage],
    ["place detail page", placePage],
    ["city blog page", source("src/app/(public)/[city]/blog/[slug]/page.tsx")],
    ["city home rows", cityHomeRows],
    ["blog index", blogIndex],
    ["continuous reader", continuousReader],
  ] as const) {
    assert.ok(
      !s.includes("eventCategorySlug:") && !s.includes("meta.categoryId") && !/\bcategoryId:\s/.test(s),
      `${label}: new producers must write the single canonical meta.categorySlug field, not eventCategorySlug/categoryId aliases`,
    );
  }

  console.log("taxonomyMetaEnrichment.test.ts: OK");
}

main();
