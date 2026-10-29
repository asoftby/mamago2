import assert from "node:assert/strict";
import test from "node:test";
import { isSupportStaff, requireSupportMessageActor, SupportAccessError } from "./supportAccess";

const actor = (role: "USER" | "ADMIN" | "MODERATOR") => ({ role }) as Parameters<typeof requireSupportMessageActor>[0];

test("only staff roles may represent the platform support team", () => {
  assert.equal(isSupportStaff(actor("USER")), false);
  assert.equal(isSupportStaff(actor("ADMIN")), true);
  assert.equal(isSupportStaff(actor("MODERATOR")), true);
  assert.equal(isSupportStaff(null), false);
});
test("business cannot impersonate support staff and staff cannot impersonate business", () => {
  assert.doesNotThrow(() => requireSupportMessageActor(actor("USER"), "BUSINESS"));
  assert.doesNotThrow(() => requireSupportMessageActor(actor("ADMIN"), "STAFF"));
  assert.doesNotThrow(() => requireSupportMessageActor(actor("MODERATOR"), "STAFF"));
  assert.throws(() => requireSupportMessageActor(actor("USER"), "STAFF"), SupportAccessError);
  assert.throws(() => requireSupportMessageActor(actor("ADMIN"), "BUSINESS"), SupportAccessError);
});
