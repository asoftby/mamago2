import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Guest service: every operation is flag-gated, quantity is guarded by a row lock, tokens are hashed.
const svc = read("src/server/wishlist/wishlistPublic.service.ts");
const exported = [...svc.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
assert.equal((svc.match(/const c = ctx\(deps\)/g) ?? []).length, exported.length, "all guest operations are flag-gated");
assert.match(svc, /FOR UPDATE/, "reserve locks the item row");
assert.match(svc, /hashToken\(rawClaimToken\)/, "only the hash of the claim token is stored");
assert.doesNotMatch(svc, /claimToken:/, "no raw claim token column");
assert.match(svc, /visibility === "PRIVATE"[\s\S]{0,80}not_found/, "private lists look missing");
assert.doesNotMatch(svc, /contactEmail: true|telegramChatId: true/, "public view never selects guest contacts");

// Routes: rate limited, cookie httpOnly, no auth required.
const helper = read("src/server/wishlist/wishlistPublicRoute.ts");
assert.match(helper, /httpOnly: true/);
assert.match(helper, /checkRateLimit/);
for (const route of [
  "src/app/api/w/[token]/route.ts",
  "src/app/api/w/[token]/items/[itemId]/reserve/route.ts",
  "src/app/api/w/[token]/reservations/[reservationId]/route.ts",
]) {
  const src = read(route);
  assert.match(src, /withGuest\(/, `${route} uses the guest wrapper`);
  assert.match(src, /bucket:/, `${route} is rate limited`);
}
assert.match(read("src/app/api/wishlists/[id]/reservations/[reservationId]/route.ts"), /withWishlistUser/);

// Page: noindex + no-referrer, flag-gated.
const page = read("src/app/(public)/w/[token]/page.tsx");
assert.match(page, /index: false/);
assert.match(page, /no-referrer/);
assert.match(page, /wishlistEnabled\(\)\) notFound\(\)/);

// Review fixes: no shared "unknown" IP bucket, capability URLs stay out of analytics, atomic transitions.
{
  const route = read("src/server/wishlist/wishlistPublicRoute.ts");
  assert.doesNotMatch(route, /\?\? "unknown"/, "no shared unknown-IP bucket");
  assert.match(route, /ip \? checkRateLimit/, "per-IP bucket only with a trusted IP");
  const provider = read("src/components/providers/cookie-consent-provider.tsx");
  assert.match(provider, /isCapabilityUrlPath\(pathname\)/, "analytics skipped on capability URLs");
  assert.match(read("src/lib/analytics/privatePaths.ts"), /"\/w\/"/);
  const pub = read("src/server/wishlist/wishlistPublic.service.ts");
  const upd = pub.slice(pub.indexOf("export async function updateOwnReservation"));
  assert.match(upd, /updateMany\([\s\S]*?status: "RESERVED"/, "purchased is a conditional update");
  assert.doesNotMatch(upd, /wishlistReservation\.update\(/, "no unconditional status writes");
}

console.log("wishlistPublic contract ok");
