/**
 * Repair PLAN/APPLY/idempotency/precondition-failure coverage for
 * migratedArticlePublicationGeoRepair.ts, using scratch Article rows (not
 * the real hard-coded production IDs) against the local DB.
 * Run: set -a; source .env; set +a; pnpm exec tsx src/lib/seo/migratedArticlePublicationGeoRepair.test.ts
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import type { MigratedArticlePublicationGeoRecovery } from "./migratedArticlePublicationGeoRecovery";
import {
  applyPublicationGeoPlan,
  buildPublicationGeoPlan,
} from "./migratedArticlePublicationGeoRepair";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";

async function getMinskCity() {
  const city = await prisma.city.findFirst({
    where: { slug: "minsk", isActive: true },
    select: { id: true, slug: true },
  });
  assert.ok(city, "expected active minsk city in local DB");
  return city;
}

async function getOtherCity(excludeCityId: string) {
  const city = await prisma.city.findFirst({
    where: { isActive: true, id: { not: excludeCityId } },
    select: { id: true, slug: true },
  });
  return city;
}

async function createPendingArticle(opts: {
  slug: string;
  cityId?: string | null;
  geoScope?: "CITY" | "COUNTRY" | null;
  status?: "PENDING" | "PUBLISHED";
}) {
  return prisma.article.create({
    data: {
      title: `Publication geo repair test ${opts.slug}`,
      slug: opts.slug,
      status: opts.status ?? "PENDING",
      geoScope: opts.geoScope ?? null,
      cityId: opts.cityId ?? null,
      publishedAt: new Date("2024-06-01T00:00:00Z"),
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "text", text: "Regression fixture paragraph." }],
      },
    },
    select: { id: true, title: true, contentJson: true, publishedAt: true, slug: true },
  });
}

async function cleanup(articleId: string) {
  await prisma.article.deleteMany({ where: { id: articleId } });
}

async function testCityRecoveryApply() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-city-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery: MigratedArticlePublicationGeoRecovery = {
      articleId: fixture.id,
      title: fixture.title,
      currentSlug: slug,
      legacyUrl: `/${slug}-legacy`,
      geoScope: "CITY",
      citySlug: "minsk",
      confidence: "HIGH",
      reason: "test fixture",
    };

    const before = await prisma.article.findFirst({
      where: { ...getPublicPublishedArticleWhere(), id: fixture.id },
      select: { id: true },
    });
    assert.equal(before, null, "PENDING article must not be publicly visible before repair");

    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].action, "apply");
    assert.equal(plan[0].finalCanonicalPath, `/minsk/blog/${slug}`);

    const result = await applyPublicationGeoPlan(prisma, plan);
    assert.equal(result.applied, 1);

    const after = await prisma.article.findUnique({
      where: { id: fixture.id },
      select: {
        status: true,
        geoScope: true,
        cityId: true,
        slug: true,
        title: true,
        contentJson: true,
        publishedAt: true,
      },
    });
    assert.equal(after?.status, "PUBLISHED");
    assert.equal(after?.geoScope, "CITY");
    assert.equal(after?.cityId, minsk.id);
    // Fields the repair MUST NOT touch stay byte-identical.
    assert.equal(after?.slug, fixture.slug);
    assert.equal(after?.title, fixture.title);
    assert.deepEqual(after?.contentJson, fixture.contentJson);
    assert.equal(after?.publishedAt?.toISOString(), fixture.publishedAt?.toISOString());

    const nowPublic = await prisma.article.findFirst({
      where: { ...getPublicPublishedArticleWhere(), id: fixture.id },
      select: { id: true },
    });
    assert.ok(nowPublic, "PUBLISHED article must be publicly visible after repair");

    // Idempotent rerun: second PLAN reports already_applied, APPLY is a no-op.
    const plan2 = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan2[0].action, "already_applied");
    const result2 = await applyPublicationGeoPlan(prisma, plan2);
    assert.equal(result2.applied, 0);
  } finally {
    await cleanup(fixture.id);
  }
}

async function testCountryRecoveryApply() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-country-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery: MigratedArticlePublicationGeoRecovery = {
      articleId: fixture.id,
      title: fixture.title,
      currentSlug: slug,
      legacyUrl: `/${slug}-legacy`,
      geoScope: "COUNTRY",
      citySlug: null,
      confidence: "MEDIUM",
      reason: "test fixture",
    };

    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan[0].action, "apply");
    assert.equal(plan[0].finalCanonicalPath, `/blog/${slug}`);

    await applyPublicationGeoPlan(prisma, plan);

    const after = await prisma.article.findUnique({
      where: { id: fixture.id },
      select: { status: true, geoScope: true, cityId: true },
    });
    assert.equal(after?.status, "PUBLISHED");
    assert.equal(after?.geoScope, "COUNTRY");
    assert.equal(after?.cityId, null);
  } finally {
    await cleanup(fixture.id);
  }
}

async function testWrongCityConflictFailsClosed() {
  const minsk = await getMinskCity();
  const otherCity = await getOtherCity(minsk.id);
  if (!otherCity) {
    console.log("skip: no secondary active city for wrong-city conflict test");
    return;
  }

  const suffix = Date.now().toString(36);
  const slug = `pub-geo-wrongcity-${suffix}`;
  // Precondition violated: cityId already set to a city other than NULL.
  const fixture = await createPendingArticle({ slug, cityId: otherCity.id, geoScope: "CITY" });

  try {
    const recovery: MigratedArticlePublicationGeoRecovery = {
      articleId: fixture.id,
      title: fixture.title,
      currentSlug: slug,
      legacyUrl: `/${slug}-legacy`,
      geoScope: "CITY",
      citySlug: "minsk",
      confidence: "HIGH",
      reason: "test fixture",
    };

    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan[0].action, "conflict");

    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan));

    const after = await prisma.article.findUnique({
      where: { id: fixture.id },
      select: { status: true, geoScope: true, cityId: true },
    });
    assert.equal(after?.status, "PENDING", "conflict row must not be written");
    assert.equal(after?.cityId, otherCity.id, "conflict row must not be written");
  } finally {
    await cleanup(fixture.id);
  }
}

/**
 * PLAN and APPLY are separate round-trips. If an article's state drifts in
 * between (another process/editor writes to it after PLAN read it but
 * before APPLY runs), APPLY must not blindly trust the stale PLAN snapshot
 * and overwrite whatever is there now. It must re-check the precondition
 * atomically at write time and, if it no longer holds, abort the *entire*
 * transaction — including any row in the same APPLY call that was still
 * genuinely valid.
 */
async function testRaceDriftBetweenPlanAndApplyRollsBackWholeTransaction() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const validSlug = `pub-geo-race-valid-${suffix}`;
  const driftSlug = `pub-geo-race-drift-${suffix}`;

  const validFixture = await createPendingArticle({ slug: validSlug });
  const driftFixture = await createPendingArticle({ slug: driftSlug });

  try {
    const validRecovery: MigratedArticlePublicationGeoRecovery = {
      articleId: validFixture.id,
      title: validFixture.title,
      currentSlug: validSlug,
      legacyUrl: `/${validSlug}-legacy`,
      geoScope: "CITY",
      citySlug: "minsk",
      confidence: "HIGH",
      reason: "test fixture",
    };
    const driftRecovery: MigratedArticlePublicationGeoRecovery = {
      articleId: driftFixture.id,
      title: driftFixture.title,
      currentSlug: driftSlug,
      legacyUrl: `/${driftSlug}-legacy`,
      geoScope: "CITY",
      citySlug: "minsk",
      confidence: "HIGH",
      reason: "test fixture",
    };

    // PLAN observes both rows as clean PENDING/null/null -> both "apply".
    const plan = await buildPublicationGeoPlan(prisma, [validRecovery, driftRecovery], minsk.id);
    assert.equal(plan[0].action, "apply");
    assert.equal(plan[1].action, "apply");

    // Simulate external drift on driftFixture AFTER PLAN was built, before APPLY runs.
    await prisma.article.update({
      where: { id: driftFixture.id },
      data: { status: "NEEDS_REVISION" },
    });

    // validRecovery is ordered first so its write would commit inside the
    // transaction before driftRecovery's atomic precondition check fails —
    // proving the rollback undoes an already-applied sibling write too.
    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan));

    const validAfter = await prisma.article.findUnique({
      where: { id: validFixture.id },
      select: { status: true, geoScope: true, cityId: true },
    });
    assert.equal(
      validAfter?.status,
      "PENDING",
      "sibling row in the same transaction must be rolled back, not partially applied",
    );
    assert.equal(validAfter?.geoScope, null);
    assert.equal(validAfter?.cityId, null);

    const driftAfter = await prisma.article.findUnique({
      where: { id: driftFixture.id },
      select: { status: true, geoScope: true, cityId: true },
    });
    assert.equal(driftAfter?.status, "NEEDS_REVISION", "drifted row must remain untouched by repair");
  } finally {
    await cleanup(validFixture.id);
    await cleanup(driftFixture.id);
  }
}

/** Same TOCTOU scenario, but the drift is a slug change rather than a status change. */
async function testSlugDriftBetweenPlanAndApplyFailsClosed() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-slugdrift-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery: MigratedArticlePublicationGeoRecovery = {
      articleId: fixture.id,
      title: fixture.title,
      currentSlug: slug,
      legacyUrl: `/${slug}-legacy`,
      geoScope: "CITY",
      citySlug: "minsk",
      confidence: "HIGH",
      reason: "test fixture",
    };

    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan[0].action, "apply");

    // Simulate a manual SEO-editor slug change between PLAN and APPLY.
    const driftedSlug = `${slug}-edited`;
    await prisma.article.update({ where: { id: fixture.id }, data: { slug: driftedSlug } });

    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan));

    const after = await prisma.article.findUnique({
      where: { id: fixture.id },
      select: { status: true, geoScope: true, cityId: true, slug: true },
    });
    assert.equal(after?.status, "PENDING", "slug-drifted row must not be published");
    assert.equal(after?.slug, driftedSlug, "repair must never touch slug");
  } finally {
    await cleanup(fixture.id);
  }
}

async function testMissingArticleFailsClosed() {
  const minsk = await getMinskCity();
  const recovery: MigratedArticlePublicationGeoRecovery = {
    articleId: `missing-pub-geo-${Date.now().toString(36)}`,
    title: "Missing article",
    currentSlug: "missing-pub-geo-slug",
    legacyUrl: "/missing-pub-geo-slug-legacy",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason: "test fixture",
  };

  const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
  assert.equal(plan[0].action, "not_found");
  await assert.rejects(() => applyPublicationGeoPlan(prisma, plan));
}

async function main() {
  await testCityRecoveryApply();
  await testCountryRecoveryApply();
  await testWrongCityConflictFailsClosed();
  await testRaceDriftBetweenPlanAndApplyRollsBackWholeTransaction();
  await testSlugDriftBetweenPlanAndApplyFailsClosed();
  await testMissingArticleFailsClosed();
  console.log("migratedArticlePublicationGeoRepair.test.ts: PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
