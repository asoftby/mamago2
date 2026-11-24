import assert from "node:assert/strict";
import test from "node:test";
import { businessNotificationRecipients } from "./businessNotificationRecipients";

test("guest business notification targets connected staff even if owner has no bot", () => {
  assert.deepEqual(
    businessNotificationRecipients("owner", [{ userId: "manager" }]),
    ["manager", "owner"],
  );
});

test("owner who is also an active member receives one notice", () => {
  assert.deepEqual(
    businessNotificationRecipients("owner", [{ userId: "owner" }, { userId: "manager" }]),
    ["owner", "manager"],
  );
});

test("legacy owner is retained when no active staff rows are available", () => {
  assert.deepEqual(businessNotificationRecipients("owner", []), ["owner"]);
});

test("no recipient exists without an owner or authorized staff", () => {
  assert.deepEqual(businessNotificationRecipients(null, []), []);
});
