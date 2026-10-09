import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { CurrentUser } from "@/lib/auth/safeUser";
import { canManageActivityContent } from "@/lib/auth/activityAccess";
import { canShowOfferOwnerEditOnPublicPage } from "./offerEditPermissions";
import { canEditRouteForUser } from "./routeEditPermissions";

const actor = (id: string, role: CurrentUser["role"]) => ({ id, role }) as CurrentUser;

// Routes: author, staff and editorial (authorless) routes.
assert.equal(canEditRouteForUser(null, "author"), false);
assert.equal(canEditRouteForUser(actor("author", "USER"), "author"), true);
assert.equal(canEditRouteForUser(actor("other", "USER"), "author"), false);
assert.equal(canEditRouteForUser(actor("admin", "ADMIN"), "author"), true);
assert.equal(canEditRouteForUser(actor("moderator", "MODERATOR"), null), true);
assert.equal(canEditRouteForUser(actor("author", "USER"), null), false);

// Offers: the public button uses the same server permissions as the editor.
// These cases are DB-independent; business membership is handled by the
// existing canManagePlaceAsync / content.update integration.
const unownedPlace = { createdByUserId: "creator", ownerBusinessId: null };
async function main() {
  assert.equal(await canShowOfferOwnerEditOnPublicPage(actor("admin", "ADMIN"), unownedPlace), true);
  assert.equal(await canShowOfferOwnerEditOnPublicPage(actor("moderator", "MODERATOR"), unownedPlace), true);
  assert.equal(await canShowOfferOwnerEditOnPublicPage(actor("creator", "USER"), unownedPlace), true);
  assert.equal(await canShowOfferOwnerEditOnPublicPage(actor("other", "USER"), unownedPlace), false);

  assert.equal(await canManageActivityContent(actor("admin", "ADMIN"), { canonicalBusinessId: null }), true);
  assert.equal(await canManageActivityContent(actor("moderator", "MODERATOR"), { canonicalBusinessId: null }), true);
  assert.equal(await canManageActivityContent(actor("other", "USER"), { canonicalBusinessId: null }), false);

  // Wiring regression gates: public pages must not implement their own
  // incomplete ownership-based permissions.
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
  const eventPage = source("src/app/(public)/[city]/events/[slugOrId]/page.tsx");
  assert.match(eventPage, /await canEditEventActivity\(user,/);
  assert.doesNotMatch(eventPage, /fromDb\.ownerUserId === user\.id/);

  const routePage = source("src/app/(public)/routes/[slug]/page.tsx");
  const routeClient = source("src/app/(public)/routes/[slug]/RouteDetailClient.tsx");
  assert.match(routePage, /canEdit=\{canEditRouteForUser\(user, db\.authorId\)\}/);
  assert.doesNotMatch(routeClient, /route\.authorName === user\.email/);

  console.log("public edit permissions: OK");
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
