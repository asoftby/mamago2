/**
 * Task 8 (BACKLOG-063) regression tests: the new city-scoped listing
 * metadata builders (`buildCityClassesListingMetadata`,
 * `buildCityBirthdayListingMetadata`, `buildCityRoutesListingMetadata`)
 * and their wiring into the 3 previously-metadata-less pages.
 *
 * Run: set -a; source .env; set +a; npx tsx src/lib/seo/cityKudaListingMetadata.test.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import {
  buildCityClassesListingMetadata,
  buildCityBirthdayListingMetadata,
  buildCityRoutesListingMetadata,
} from "@/lib/seo/cityKudaListingMetadata";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { formatCityTitle } from "@/lib/city/cityDisplayNames";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..");

async function main() {
  const city = await prisma.city.findFirst({
    where: { isActive: true, isLegacyNonCity: false },
    select: { slug: true, name: true },
    orderBy: { slug: "asc" },
  });
  assert.ok(city, "expected at least one active city in the local dev DB for this test");
  const citySlug = city!.slug;
  const base = getCanonicalPublicAppUrl();

  // --- classes ---
  const classesMeta = await buildCityClassesListingMetadata(citySlug);
  const expectedClassesTitleFragment = formatCityTitle(
    DISCOVERY_INTENT_CONFIG.classes.titleTemplate,
    citySlug,
  );
  assert.ok(
    typeof classesMeta.title === "string" && classesMeta.title.includes(expectedClassesTitleFragment),
    "classes title must match the same template used for the page's own H1",
  );
  assert.equal(
    classesMeta.alternates?.canonical,
    `${base}/${citySlug}/classes`,
    "classes canonical must be the absolute /{city}/classes URL",
  );
  assert.ok(
    typeof classesMeta.description === "string" && classesMeta.description.length > 0,
    "classes description must be non-empty",
  );

  // --- birthday ---
  const birthdayMeta = await buildCityBirthdayListingMetadata(citySlug);
  const expectedBirthdayTitleFragment = formatCityTitle(
    DISCOVERY_INTENT_CONFIG.birthday.titleTemplate,
    citySlug,
  );
  assert.ok(
    typeof birthdayMeta.title === "string" && birthdayMeta.title.includes(expectedBirthdayTitleFragment),
    "birthday title must match the same template used for the page's own H1",
  );
  assert.equal(
    birthdayMeta.alternates?.canonical,
    `${base}/${citySlug}/birthday`,
    "birthday canonical must be the absolute /{city}/birthday URL",
  );

  // --- routes (city-scoped listing) ---
  const routesMeta = await buildCityRoutesListingMetadata(citySlug);
  const expectedRoutesTitleFragment = formatCityTitle(
    DISCOVERY_INTENT_CONFIG.routes.titleTemplate,
    citySlug,
  );
  assert.ok(
    typeof routesMeta.title === "string" && routesMeta.title.includes(expectedRoutesTitleFragment),
    "routes title must match the same template used for the page's own H1",
  );
  assert.equal(
    routesMeta.alternates?.canonical,
    `${base}/${citySlug}/routes`,
    "routes canonical must be the absolute /{city}/routes URL",
  );
  assert.notEqual(
    routesMeta.title,
    classesMeta.title,
    "routes and classes titles must not collide (each page needs a unique title)",
  );

  // --- unknown city slug: no fabricated metadata ---
  const unknownSlug = `no-such-city-${Date.now()}`;
  assert.deepEqual(await buildCityClassesListingMetadata(unknownSlug), {});
  assert.deepEqual(await buildCityBirthdayListingMetadata(unknownSlug), {});
  assert.deepEqual(await buildCityRoutesListingMetadata(unknownSlug), {});

  // --- global noindex override still wins for all 3 new pages ---
  // Mirrors globalNoindex.test.ts's subprocess-isolation approach so env
  // vars from this process can't leak into the probe.
  const pages: Array<{ label: string; file: string }> = [
    { label: "classes", file: "src/app/(public)/[city]/classes/page.tsx" },
    { label: "birthday", file: "src/app/(public)/[city]/birthday/page.tsx" },
    { label: "routes", file: "src/app/(public)/[city]/routes/page.tsx" },
  ];
  for (const page of pages) {
    const modulePath = path.join(REPO_ROOT, page.file);
    const script = `
      import { generateMetadata } from ${JSON.stringify(modulePath)};
      (async () => {
        const result = await generateMetadata({ params: Promise.resolve({ city: ${JSON.stringify(citySlug)} }) });
        console.log(JSON.stringify({ robots: result.robots }));
      })();
    `;
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
    delete cleanEnv.SITE_NOINDEX_FORCE;
    delete cleanEnv.SITE_NOINDEX_DEFAULT;
    delete cleanEnv.SITE_INDEXING_ENABLED;
    const out = execFileSync("npx", ["tsx", "--eval", script], {
      cwd: REPO_ROOT,
      env: cleanEnv,
      encoding: "utf8",
    });
    const parsed = JSON.parse(out.trim().split("\n").pop()!);
    assert.deepEqual(
      parsed.robots,
      { index: false, follow: false },
      `${page.label} generateMetadata() must resolve to noindex robots when no indexing flag is set (prelaunch default)`,
    );
  }

  console.log("cityKudaListingMetadata (Task 8 / BACKLOG-063) tests: OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
