import assert from "node:assert/strict";
import {
  isPermanentlyNoindexPath,
  isPermanentlyNoindexSurface,
} from "./indexingPolicy";

for (const pathname of [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password/token",
  "/activate",
  "/settings/profile",
  "/me/ideas",
  "/editor/event/new",
  "/preview/articles/abc",
  "/invite/business",
  "/u/token",
  "/routes/new",
  "/routes/family-day/edit",
  "/minsk/birthday",
  "/minsk/birthday/make",
  "/ui-lab",
  "/__filters-demo",
]) {
  assert.equal(isPermanentlyNoindexPath(pathname), true, `${pathname} must stay noindex`);
}

for (const pathname of [
  "/minsk",
  "/minsk/events",
  "/minsk/events/family-day",
  "/minsk/classes",
  "/minsk/routes",
  "/routes",
  "/routes/family-day",
  "/blog",
  "/blog/family-guide",
  "/minsk/blog/family-guide",
  "/minsk/places/kids-cafe",
  "/minsk/offers/art-class",
]) {
  assert.equal(isPermanentlyNoindexPath(pathname), false, `${pathname} must remain eligible for indexation`);
}

assert.equal(isPermanentlyNoindexSurface("admin"), true);
assert.equal(isPermanentlyNoindexSurface("business"), true);
assert.equal(isPermanentlyNoindexSurface("public"), false);

console.log("indexing policy tests: OK");
