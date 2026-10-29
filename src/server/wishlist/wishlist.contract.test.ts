import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const sql = read("prisma/migrations/20261029180000_wishlist_core/migration.sql");
const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
assert.doesNotMatch(code, /^\s*(DROP |DELETE FROM|UPDATE "|TRUNCATE)/m, "migration is additive only");
for (const m of code.matchAll(/ALTER TABLE "(\w+)"/g)) {
  assert.ok(["Wishlist", "WishlistItem", "WishlistReservation"].includes(m[1]), `unexpected ALTER TABLE ${m[1]}`);
}
assert.match(sql, /CREATE UNIQUE INDEX "Wishlist_shareToken_key"/);
assert.match(sql, /CREATE UNIQUE INDEX "WishlistReservation_claimTokenHash_key"/);
assert.match(sql, /"WishlistItem_quantity_check" CHECK \("quantity" BETWEEN 1 AND 99\)/);
assert.match(sql, /"WishlistReservation_quantity_check" CHECK/);
assert.doesNotMatch(sql, /"claimToken"\s+TEXT/, "raw claim token must never be stored");

const schema = read("prisma/schema.prisma");
for (const model of ["Wishlist", "WishlistItem", "WishlistReservation"]) {
  assert.match(schema, new RegExp(`model ${model} \\{`));
}
assert.match(read("src/lib/prisma.ts"), /PRISMA_CACHE_VERSION = "v\d+"/);

// Service: every public operation goes through the flag gate and ACL.
const svc = read("src/server/wishlist/wishlist.service.ts");
const exported = [...svc.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
assert.ok(exported.length >= 10, "service surface present");
assert.equal((svc.match(/const c = ctx\(deps\)/g) ?? []).length, exported.length, "all operations are flag-gated");
assert.match(svc, /FOR UPDATE/, "item mutations lock the row");
assert.match(svc, /confirmReserved/, "reserved items need explicit confirmation");
assert.match(svc, /ITEM_REMOVED/);
assert.match(svc, /ensureFamilyForUser/, "reuses Family Core, no parallel family logic");
assert.match(svc, /childScopeWhere/, "recipient child checked with the shared child ACL");

// Routes: all author routes use the shared auth + flag wrapper.
for (const route of [
  "src/app/api/wishlists/route.ts",
  "src/app/api/wishlists/[id]/route.ts",
  "src/app/api/wishlists/[id]/items/route.ts",
  "src/app/api/wishlists/[id]/items/[itemId]/route.ts",
  "src/app/api/wishlists/[id]/items/reorder/route.ts",
  "src/app/api/wishlists/[id]/rotate-link/route.ts",
  "src/app/api/wishlists/[id]/archive/route.ts",
]) {
  assert.match(read(route), /withWishlistUser/, `${route} uses withWishlistUser`);
}
const wrapper = read("src/server/wishlist/wishlistRoute.ts");
assert.match(wrapper, /wishlistEnabled\(\)/);
assert.match(wrapper, /getCurrentUser/);

// Pages: flag-gated, noindex, auth required.
for (const page of ["src/app/(public)/me/wishlists/page.tsx", "src/app/(public)/me/wishlists/[id]/page.tsx"]) {
  const src = read(page);
  assert.match(src, /wishlistEnabled\(\)/, `${page} is flag-gated`);
  assert.match(src, /applyGlobalRobotsOverride/, `${page} has robots override`);
  assert.match(src, /redirect\(/, `${page} requires login`);
}

console.log("wishlist contract ok");
