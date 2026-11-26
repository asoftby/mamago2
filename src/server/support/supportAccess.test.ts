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
test("only active business members may send business messages, including admins in the business cabinet", () => {
  for (const role of ["USER", "ADMIN", "MODERATOR"] as const) {
    assert.doesNotThrow(() => requireSupportMessageActor(actor(role), "BUSINESS", true));
    assert.throws(
      () => requireSupportMessageActor(actor(role), "BUSINESS", false),
      (error: unknown) => error instanceof SupportAccessError && error.status === 404,
    );
  }
});

test("only platform staff may send staff replies", () => {
  assert.doesNotThrow(() => requireSupportMessageActor(actor("ADMIN"), "STAFF", false));
  assert.doesNotThrow(() => requireSupportMessageActor(actor("MODERATOR"), "STAFF", false));
  assert.throws(
    () => requireSupportMessageActor(actor("USER"), "STAFF", true),
    (error: unknown) => error instanceof SupportAccessError && error.status === 403,
  );
});
