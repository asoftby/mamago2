/**
 * #706 regression: published Offer whose public page was dead.
 *
 * The detail page's own visibility check (`isOfferPubliclyVisible`) and the data
 * loader's SQL filter (`getPublicPublishedOfferWhere`) must agree, the loader must
 * resolve by the id the page already chose (slug mismatch -> null, never another
 * offer), and moderation must not publish an Offer onto a non-public Place.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import prisma, { prismaBase } from "@/lib/prisma";
import { getOfferPageData } from "./offerPageData";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { approveOffer } from "@/server/services/moderation.service";

type Stub = (...args: unknown[]) => Promise<unknown>;

function stub<T extends object>(target: T, key: string, fn: Stub): () => void {
  const original = (target as Record<string, unknown>)[key];
  Object.defineProperty(target, key, { value: fn, configurable: true, writable: true });
  return () => Object.defineProperty(target, key, { value: original, configurable: true, writable: true });
}

async function loaderRequiresIdSlugAndPublishedPlace() {
  let capturedWhere: unknown;
  const restore = stub(prisma.offer, "findFirst", async (args) => {
    capturedWhere = (args as { where: unknown }).where;
    return null; // DB finds nothing: slug mismatch / no Place / Place not published
  });
  try {
    const result = await getOfferPageData({ citySlug: "minsk", slug: "wrong-slug", offerId: "offer-1" });
    assert.equal(result, null, "no matching row -> loader returns null (page 404s), never a blank render");
  } finally {
    restore();
  }
  const and = (capturedWhere as { AND: unknown[] }).AND;
  assert.deepEqual(and[0], { id: "offer-1", slug: "wrong-slug" }, "id AND slug must both match");
  assert.deepEqual(and[1], getPublicPublishedOfferWhere(), "loader applies the shared public Offer filter");

  const publicWhere = JSON.stringify(getPublicPublishedOfferWhere());
  assert.ok(publicWhere.includes('"status":"PUBLISHED"'));
  assert.ok(publicWhere.includes('"archivedAt":null'));
  assert.ok(/"place":\{"AND":\[\{"status":"PUBLISHED"\}/.test(publicWhere), "Place must be PUBLISHED in SQL filter");
}

async function approveRejectsNonPublicPlace() {
  const cases: Array<{ name: string; place: unknown; error: RegExp }> = [
    { name: "no Place relation", place: null, error: /without a Place/ },
    { name: "DRAFT place", place: { ownerBusinessId: "b", status: "DRAFT", archivedAt: null }, error: /not published/ },
    { name: "PENDING place", place: { ownerBusinessId: "b", status: "PENDING", archivedAt: null }, error: /not published/ },
    { name: "archived place", place: { ownerBusinessId: "b", status: "PUBLISHED", archivedAt: new Date() }, error: /archived/ },
  ];
  for (const c of cases) {
    let writes = 0;
    const restoreFind = stub(prisma.offer, "findUnique", async () => ({
      status: "PENDING",
      title: "t",
      slug: "t",
      placeId: c.place ? "p1" : null,
      place: c.place,
    }));
    const restoreUpdate = stub(prismaBase.offer, "update", async () => {
      writes += 1;
      return {};
    });
    try {
      await assert.rejects(() => approveOffer("offer-1", "admin-1"), c.error, c.name);
      assert.equal(writes, 0, `${c.name}: Offer must not be flipped to PUBLISHED`);
    } finally {
      restoreFind();
      restoreUpdate();
    }
  }
}

function pagesSelectPlaceStatus() {
  const root = path.resolve(__dirname, "../../app/(public)");
  for (const file of ["[city]/offers/[slug]/page.tsx", "[city]/offers/[slug]/[legacySlug]/page.tsx", "offers/[slug]/page.tsx"]) {
    const src = readFileSync(path.join(root, file), "utf8");
    assert.ok(src.includes("isOfferPubliclyVisible"), `${file} gates on isOfferPubliclyVisible`);
    const placeSelects = src.match(/place:\s*\{\s*select:\s*\{[^}]*?\n/g) ?? [];
    assert.ok(placeSelects.length > 0, `${file} has place selects`);
    assert.ok(/\bstatus: true,[\s\S]{0,80}archivedAt: true|title: true,\s*status: true/.test(src), `${file} selects place.status`);
  }
}

async function main() {
  await loaderRequiresIdSlugAndPublishedPlace();
  await approveRejectsNonPublicPlace();
  pagesSelectPlaceStatus();
  console.log("offerPublicPage contract tests: OK");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
