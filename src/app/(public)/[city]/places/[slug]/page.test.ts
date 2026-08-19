/**
 * Regression test: /{city}/places/[slug] used to re-export
 * places/[slug]/page.tsx directly, which never reads `city` at all — so it
 * rendered an identical HTTP 200 for ANY city segment (a wrong-city
 * indexable duplicate for every published Place, since Place has no
 * city-scoped canonical). Now it always redirects to the one true
 * `/places/{slug}` canonical, regardless of the city segment.
 *
 * Reads a real published Place from the local dev DB (read-only) and calls
 * the page's default export directly, asserting on the NEXT_REDIRECT /
 * NEXT_HTTP_ERROR_FALLBACK digest Next.js throws instead of returning.
 *
 * Запуск: set -a; source .env; set +a; npx tsx "src/app/(public)/[city]/places/[slug]/page.test.ts"
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import CityPlaceRedirectPage from "./page";

function digestOf(err: unknown): string {
  return (err as { digest?: string }).digest ?? "";
}

async function testAnyCityRedirectsToRealCanonical() {
  const place = await prisma.place.findFirst({
    where: { status: "PUBLISHED", archivedAt: null, slug: { not: null } },
    select: { slug: true },
  });
  assert.ok(place?.slug, "expected at least one published Place with a slug in the local dev DB");

  for (const city of ["minsk", "gomel", "totally-not-a-real-city"]) {
    let digest = "";
    try {
      await CityPlaceRedirectPage({ params: Promise.resolve({ city, slug: place!.slug! }) });
      assert.fail(`expected a redirect for city=${city}`);
    } catch (err) {
      digest = digestOf(err);
    }
    assert.ok(digest.startsWith("NEXT_REDIRECT"), `expected NEXT_REDIRECT digest for city=${city}, got: ${digest}`);
    assert.ok(
      digest.includes(`/places/${place!.slug}`),
      `expected redirect to /places/${place!.slug} for city=${city}, got: ${digest}`,
    );
  }
}

async function testUnknownSlugStill404s() {
  let digest = "";
  try {
    await CityPlaceRedirectPage({ params: Promise.resolve({ city: "minsk", slug: "definitely-not-a-real-place-slug" }) });
    assert.fail("expected notFound()");
  } catch (err) {
    digest = digestOf(err);
  }
  assert.equal(digest, "NEXT_HTTP_ERROR_FALLBACK;404");
}

async function main() {
  await testAnyCityRedirectsToRealCanonical();
  await testUnknownSlugStill404s();
  console.log("[city]/places/[slug] redirect tests: OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
