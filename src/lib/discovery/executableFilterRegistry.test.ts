import assert from "node:assert/strict";
import test from "node:test";
import { isExecutableAdminFilterKey, isExecutableEventFilterKey } from "./executableFilterRegistry";

test("only code-owned event keys are executable", () => {
  assert.equal(isExecutableEventFilterKey("date"), true);
  assert.equal(isExecutableEventFilterKey("district"), true);
  assert.equal(isExecutableEventFilterKey("admin_sql"), false);
});

test("unknown Admin definitions fail closed", () => {
  assert.equal(isExecutableAdminFilterKey("kuda", "free_only"), true);
  assert.equal(isExecutableAdminFilterKey("kuda", "adult_only"), true);
  assert.equal(isExecutableAdminFilterKey("kuda", "activity_type"), false);
  assert.equal(isExecutableAdminFilterKey("classes", "free_only"), false);
});
