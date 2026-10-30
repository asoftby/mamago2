import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NOTIFICATION_REGISTRY } from "@/lib/notifications/notificationRegistry";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Guest service: every operation is flag-gated, quantity is guarded by a row lock, tokens are hashed.
const svc = read("src/server/wishlist/wishlistPublic.service.ts");
const exported = [...svc.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
assert.equal((svc.match(/const c = ctx\(deps\)/g) ?? []).length, exported.length, "all guest operations are flag-gated");
assert.match(svc, /FOR UPDATE/, "reserve locks the item row");
assert.match(svc, /hashToken\(rawClaimToken\)/, "only the hash of the claim token is stored");
assert.doesNotMatch(svc, /claimToken:/, "no raw claim token column");
assert.match(svc, /visibility === "PRIVATE"[\s\S]{0,80}not_found/, "private lists look missing");
assert.match(svc, /contact: r\.telegramChatId \? \("telegram" as const\) : r\.contactEmail \? \("email" as const\) : null/, "public view exposes only the contact kind");
assert.doesNotMatch(svc, /contactEmail: r\.contactEmail|telegramChatId: r\.telegramChatId/, "raw guest contacts never reach the public view");

// Notifications (PR 4)
const notify = read("src/server/wishlist/wishlistNotify.ts");
assert.match(notify, /hideReservationsFromOwner\) return/, "surprise mode: author is never told about reservations");
assert.match(notify, /parseTelegramLinkPayload/, "telegram binding requires the signed payload");
assert.doesNotMatch(notify, /console\.(log|error)\([^)]*(contactEmail|telegramChatId|displayName)/, "no contacts in logs");
assert.match(read("src/server/services/telegram/TelegramWebhookService.ts"), /startsWith\("wl_"\)/, "webhook routes wl_ payloads");

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

// Link previews (PR 3): reuse the pinned SSRF-safe transport; image stored on our side.
const preview = read("src/server/wishlist/linkPreview.ts");
assert.match(preview, /fetchHtml\(/, "previews reuse the import transport");
assert.match(preview, /uploadImageFromUrl\(/, "preview image is stored locally, never hotlinked");
assert.match(preview, /assertSafeRemoteImageUrl/, "generic public-http(s) policy for images");
assert.doesNotMatch(preview, /\bfetch\(/, "no raw fetch");
const previewRoute = read("src/app/api/wishlists/[id]/items/[itemId]/preview/route.ts");
assert.match(previewRoute, /withWishlistUser/);
assert.match(previewRoute, /checkRateLimit/);
assert.match(read("src/lib/upload/uploadFromUrl.ts"), /options\.validateUrl \?\?/, "default Instagram policy is kept");

// Integrations (PR 5): offers go through the shared visibility rule; gated by the flag.
assert.match(read("src/server/wishlist/wishlist.service.ts"), /isOfferPubliclyVisible/, "only publicly visible offers become gifts");
assert.match(read("src/app/(public)/me/birthdays/[id]/page.tsx"), /giftsHref: wishlistEnabled\(\)/, "party gifts entry is flag-gated and lives on the screen that is actually routed");
assert.match(read("src/features/me/components/PartyOrderStatusScreen.tsx"), /party\.giftsHref/, "the routed party screen renders the gifts block");
assert.match(read("src/app/(public)/[city]/offers/[slug]/page.tsx"), /wishlistEnabled=\{wishlistEnabled\(\)\}/, "offer button is flag-gated");
assert.doesNotMatch(read("src/features/wishlist/components/AddOfferToWishlist.tsx"), /intent=/, "no intent param before its dedicated task");

// Stored photos have no MediaAsset: they are served by wishlist routes with their own ACL.
{
  const pubRoute = read("src/app/api/w/[token]/items/[itemId]/image/route.ts");
  assert.match(pubRoute, /getPublicItemImageUrl/);
  const ownerRoute = read("src/app/api/wishlists/[id]/items/[itemId]/image/route.ts");
  assert.match(ownerRoute, /getCurrentUser/);
  assert.match(ownerRoute, /getOwnerItemImageUrl/);
  const img = read("src/server/wishlist/wishlistImage.ts");
  assert.doesNotMatch(img, /"image\/svg/, "svg is never served");
  assert.doesNotMatch(read("src/features/wishlist/components/PublicWishlist.tsx"), /item\.imageUrl/, "guests never use the raw stored path");
}

// Notifications: a registered type (SYSTEM_INFO is silent by default), contacts honoured for account holders.
{
  assert.equal(NOTIFICATION_REGISTRY.SYSTEM?.defaultChannels.inApp, true, "SYSTEM is delivered in-app by default");
  assert.equal(NOTIFICATION_REGISTRY.SYSTEM_INFO, undefined, "SYSTEM_INFO has no registry entry (silent)");
  const notify = read("src/server/wishlist/wishlistNotify.ts");
  assert.doesNotMatch(notify, /type:\s*"SYSTEM_INFO"/, "no wishlist notice uses the unregistered type");
  assert.doesNotMatch(notify, /account notice failed", error\);\s*\}\s*return;/, "account holders still get reservation contacts");
}

console.log("wishlistPublic contract ok");
