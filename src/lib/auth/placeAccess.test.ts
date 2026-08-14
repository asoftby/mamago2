import assert from "node:assert/strict";

import { canManagePlaceAsync } from "./placeAccess";

/**
 * Only exercises the DB-independent branches (admin/moderator short-circuit,
 * and the new null-place branch) — the business-owner branch calls
 * canAccessBusiness() against the real DB and is out of scope here.
 */
async function main() {
  assert.equal(
    await canManagePlaceAsync({ id: "admin-1", role: "ADMIN" }, null),
    true,
    "Admin can manage an unassigned (placeless) Offer",
  );
  assert.equal(
    await canManagePlaceAsync({ id: "mod-1", role: "MODERATOR" }, null),
    true,
    "Moderator can manage an unassigned (placeless) Offer",
  );
  assert.equal(
    await canManagePlaceAsync({ id: "user-1", role: "USER" }, null),
    false,
    "A regular user cannot manage an unassigned (placeless) Offer — nothing links it to them",
  );
  assert.equal(
    await canManagePlaceAsync({ id: "biz-1", role: "BUSINESS_OWNER" }, null),
    false,
    "A business owner cannot manage an unassigned (placeless) Offer",
  );
}

main()
  .then(() => console.log("placeAccess tests: OK"))
  .catch((error) => {
    console.error("placeAccess tests: FAILED", error);
    process.exitCode = 1;
  });
