/**
 * Read-only live WordPress inventory for Phoenix FULL PROD scope.
 * No WordPress writes. No mamaGo writes. No freeze.
 *
 *   pnpm migration:scope:wordpress-db --allow-remote-readonly --out /tmp/phoenix-scope.json
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import { WordPressRepository } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import { normalizeArticle } from "../src/lib/migration/adapters/wordpress-db/normalizeArticle";
import { normalizeEvent } from "../src/lib/migration/adapters/wordpress-db/normalizeEvent";
import { normalizeOffer } from "../src/lib/migration/adapters/wordpress-db/normalizeOffer";
import { normalizePlace } from "../src/lib/migration/adapters/wordpress-db/normalizePlace";
import { normalizeRoute } from "../src/lib/migration/adapters/wordpress-db/normalizeRoute";
import { hashReviewCandidate, normalizeReview } from "../src/lib/migration/adapters/wordpress-db/normalizeReview";
import {
  hashArticleBundle,
  hashEventBundle,
  hashOfferBundle,
  hashPlaceBundle,
  hashRouteBundle,
} from "../src/lib/migration/adapters/wordpress-db/canonicalSourceHash";
import { collapseOfferPlaceRelations } from "../src/lib/migration/commit/offer/collapseOfferPlaceRelations";
import {
  classifyLiveUserEligibility,
  readFounderExclusionKeys,
  userSourceCandidateFromWordPressRow,
} from "../src/lib/migration/commit/user/liveWordPressUserSource";
import { normalizeUserCandidate } from "../src/lib/migration/commit/user/UserMigrationVerticalSlice";

type ScopeRow = {
  sourceRecordKey: string;
  eligible: boolean;
  exclusionReason: string | null;
  sourceHash?: string;
  mapping?: Record<string, unknown>;
};

function parseArgs(argv: readonly string[]) {
  const outIndex = argv.indexOf("--out");
  return {
    allowRemoteReadonly: argv.includes("--allow-remote-readonly"),
    out: outIndex >= 0 ? argv[outIndex + 1] : undefined,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const wpConfig = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(wpConfig, args.allowRemoteReadonly);
  const repo = new WordPressRepository(createWordPressSshMysqlExecutor(wpConfig));
  const now = new Date();
  const excludedUsers = readFounderExclusionKeys();

  const users = await repo.getUsers(20000);
  const places = await repo.getPublishedPlaces(20000);
  const events = await repo.getPublishedEvents(20000);
  const articles = await repo.getPublishedArticles(20000);
  const routes = await repo.getPublishedRoutes(20000);
  const offers = await repo.getPublishedOffers(20000);
  const reviews = await repo.getVoxelPostReviews(20000);

  const userRows: ScopeRow[] = users.map((row) => {
    const source = userSourceCandidateFromWordPressRow(row, { excludedKeys: excludedUsers });
    const eligibility = classifyLiveUserEligibility(source.sourceRecordKey, excludedUsers);
    const candidate = normalizeUserCandidate(source);
    return {
      sourceRecordKey: source.sourceRecordKey,
      eligible: eligibility.eligible && Boolean(candidate.normalizedEmail),
      exclusionReason: eligibility.exclusionReason ?? (candidate.normalizedEmail ? null : "INVALID_EMAIL"),
      sourceHash: source.sourceHash,
      mapping: { legacyUserId: row.ID },
    };
  });

  const placeRows: ScopeRow[] = places.map((bundle) => {
    const record = normalizePlace(bundle);
    return {
      sourceRecordKey: record.sourceRecordKey,
      eligible: true,
      exclusionReason: null,
      sourceHash: hashPlaceBundle(bundle),
      mapping: {
        logoAttachmentId: (record.normalizedPayload as { media: { logoAttachmentId: number | null } }).media.logoAttachmentId,
        mediaRefs: record.mediaRefs,
      },
    };
  });

  const eventRows: ScopeRow[] = events.map((bundle) => {
    const record = normalizeEvent(bundle, { now });
    const pastOnly = record.warnings?.some((warning) => warning.code === "EVENT_PAST_ONLY_EXCLUDED") ?? false;
    return {
      sourceRecordKey: record.sourceRecordKey,
      eligible: !pastOnly,
      exclusionReason: pastOnly ? "EVENT_PAST_ONLY_EXCLUDED" : null,
      sourceHash: hashEventBundle(bundle),
      mapping: { mediaRefs: record.mediaRefs },
    };
  });

  const articleRows: ScopeRow[] = articles.map((bundle) => {
    const record = normalizeArticle(bundle);
    return {
      sourceRecordKey: record.sourceRecordKey,
      eligible: true,
      exclusionReason: null,
      sourceHash: hashArticleBundle(bundle),
      mapping: { mediaRefs: record.mediaRefs },
    };
  });

  const routeRows: ScopeRow[] = routes.map((bundle) => {
    const record = normalizeRoute(bundle);
    return {
      sourceRecordKey: record.sourceRecordKey,
      eligible: true,
      exclusionReason: null,
      sourceHash: hashRouteBundle(bundle),
      mapping: { mediaRefs: record.mediaRefs },
    };
  });

  const offerRows: ScopeRow[] = offers.map((bundle) => {
    const record = normalizeOffer(bundle);
    const candidate = record.normalizedPayload as import("../src/lib/migration/adapters/wordpress-db/normalizeOffer").NormalizedOfferCandidate;
    const collapse = collapseOfferPlaceRelations({
      offerPostId: candidate.sourcePostId,
      relations: candidate.placeRelation.relations,
    });
    const eligible = collapse.status === "RESOLVED";
    return {
      sourceRecordKey: record.sourceRecordKey,
      eligible,
      exclusionReason: eligible ? null : `OFFER_PLACE_RELATION_${collapse.status}`,
      sourceHash: hashOfferBundle(bundle),
      mapping: {
        legacyPlaceId: collapse.status === "RESOLVED" ? collapse.effectiveLegacyPlaceId : null,
        media: candidate.media,
      },
    };
  });

  const reviewRows: ScopeRow[] = reviews.map((row) => {
    const record = normalizeReview(row);
    const candidate = record.normalizedPayload as import("../src/lib/migration/adapters/wordpress-db/normalizeReview").NormalizedReviewCandidate;
    let exclusionReason: string | null = null;
    if (candidate.rating === null) exclusionReason = "REVIEW_SKIP_INVALID_SCORE";
    else if (candidate.placeStatus && candidate.placeStatus !== "publish") exclusionReason = "REVIEW_SKIP_UNPUBLISHED_PLACE";
    return {
      sourceRecordKey: record.sourceRecordKey,
      eligible: exclusionReason === null,
      exclusionReason,
      sourceHash: hashReviewCandidate(candidate),
      mapping: {
        userSourceRecordKey: candidate.userSourceRecordKey,
        placeSourceRecordKey: candidate.placeSourceRecordKey,
        sourceReviewId: candidate.sourceReviewId,
        rating: candidate.rating,
      },
    };
  });

  const report = {
    generatedAt: now.toISOString(),
    readOnly: true,
    wordpressWrites: false,
    freeze: false,
    counts: {
      users: { total: userRows.length, eligible: userRows.filter((row) => row.eligible).length },
      places: { total: placeRows.length, eligible: placeRows.filter((row) => row.eligible).length },
      events: { total: eventRows.length, eligible: eventRows.filter((row) => row.eligible).length },
      articles: { total: articleRows.length, eligible: articleRows.filter((row) => row.eligible).length },
      routes: { total: routeRows.length, eligible: routeRows.filter((row) => row.eligible).length },
      offers: { total: offerRows.length, eligible: offerRows.filter((row) => row.eligible).length },
      reviews: { total: reviewRows.length, eligible: reviewRows.filter((row) => row.eligible).length },
    },
    entities: { users: userRows, places: placeRows, events: eventRows, articles: articleRows, routes: routeRows, offers: offerRows, reviews: reviewRows },
    media: {
      policy: "FULL",
      note: "FULL_IMPORT + FULL migrates cover/gallery/logo/inline media for every eligible entity. Business has no image column; User.avatarUrl is not sourced from a proven WP field in this importer.",
    },
  };

  const json = JSON.stringify(report, null, 2);
  if (args.out) writeFileSync(args.out, json);
  console.log(JSON.stringify({ generatedAt: report.generatedAt, counts: report.counts, out: args.out ?? null }, null, 2));
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
