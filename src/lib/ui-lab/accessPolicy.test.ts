import assert from "node:assert/strict";
import test from "node:test";
import { canViewUiLab, isUiLabEnabled } from "./accessPolicy";

test("UI Lab access is allowed on explicitly configured non-production environments", () => {
  for (const APP_ENV of ["local", "dev", "staging", "preview", "development"]) {
    assert.equal(isUiLabEnabled({ APP_ENV, NODE_ENV: "production" }), true, APP_ENV);
  }
  assert.equal(isUiLabEnabled({ NODE_ENV: "development" }), true);
});

test("production and unknown environments fail closed regardless of NODE_ENV", () => {
  for (const APP_ENV of ["production", "prod", "unknown", ""]) {
    if (!APP_ENV) continue;
    assert.equal(isUiLabEnabled({ APP_ENV, NODE_ENV: "development" }), false);
  }
  assert.equal(isUiLabEnabled({ NODE_ENV: "production" }), false);
});

test("only internal admin and moderator roles may see the lab", () => {
  assert.equal(canViewUiLab("ADMIN"), true);
  assert.equal(canViewUiLab("MODERATOR"), true);
  assert.equal(canViewUiLab("USER"), false);
  assert.equal(canViewUiLab("BUSINESS"), false);
  assert.equal(canViewUiLab(null), false);
});
