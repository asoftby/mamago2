import assert from "node:assert/strict";

import { resolveContentListHref } from "./resolver";

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "admin",
    outcome: "published",
    id: "offer-1",
  }),
  "/admin/content/offers",
);

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "business",
    outcome: "published",
    id: "offer-1",
  }),
  "/business/publications/offers",
);

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "business",
    outcome: "published",
    id: "offer-1",
    role: "ADMIN",
    returnTo: "/admin/content/offers",
  }),
  "/admin/content/offers",
);

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "admin",
    outcome: "published",
    id: "offer-1",
    role: "ADMIN",
    returnTo: "/business/onboarding",
  }),
  "/admin/content/offers",
);

assert.equal(
  resolveContentListHref({
    kind: "offer",
    surface: "business",
    outcome: "submitted",
    id: "offer-1",
    role: "BUSINESS_OWNER",
    returnTo: "/business/onboarding",
  }),
  "/business/onboarding",
);

assert.equal(
  resolveContentListHref({
    kind: "place",
    surface: "business",
    outcome: "published",
    id: "place-1",
    role: "BUSINESS_OWNER",
    returnTo: "/admin/content/places",
  }),
  "/business/publications/places",
);

console.log("content success resolver tests: OK");
