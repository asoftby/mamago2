import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPublicPathBlockedByReleaseScope,
} from "./publicReleaseScope";

const deferred = [
  "/minsk/classes",
  "/minsk/classes/sport",
  "/minsk/programs",
  "/minsk/programs/example",
  "/minsk/birthday",
  "/minsk/birthday/make",
  "/brest/classes",
  "/vilnius/birthday",
  "/minsk/classes/",
];

const retained = [
  "/",
  "/minsk",
  "/minsk/events",
  "/minsk/events/example",
  "/minsk/blog",
  "/minsk/routes",
  "/minsk/places/example",
  "/minsk/offers/example",
  "/minsk/classes-extra",
  "/me/birthdays",
  "/me/birthdays/example",
  "/admin/classes",
  "/business/birthday",
  "/api/birthday",
  "/editor/classes",
];

test("PROD blocks deferred public routes and descendants", () => {
  for (const pathname of deferred) {
    assert.equal(
      isPublicPathBlockedByReleaseScope(pathname, {
        APP_ENV: "production",
      }),
      true,
      pathname,
    );
  }
});

test("DEV retains all deferred public routes", () => {
  for (const pathname of deferred) {
    assert.equal(
      isPublicPathBlockedByReleaseScope(pathname, {
        APP_ENV: "dev",
      }),
      false,
      pathname,
    );
  }
});

test("PROD preserves unrelated routes", () => {
  for (const pathname of retained) {
    assert.equal(
      isPublicPathBlockedByReleaseScope(pathname, {
        APP_ENV: "production",
      }),
      false,
      pathname,
    );
  }
});

test("Unknown or missing environment fails closed", () => {
  for (const APP_ENV of [undefined, "", "unknown", "prod"]) {
    assert.equal(
      isPublicPathBlockedByReleaseScope("/minsk/classes", {
        APP_ENV,
      }),
      true,
    );
  }
});
