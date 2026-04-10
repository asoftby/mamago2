import assert from "node:assert/strict";

import {
  defaultEditorNav,
  defaultNavForSurface,
  resolveEditorReturnDestination,
} from "./types.ts";

assert.deepEqual(defaultEditorNav("admin", "event"), {
  afterSubmitListPath: "/admin/content/events",
});

assert.deepEqual(defaultEditorNav("business", "offer"), {
  afterSubmitListPath: "/business/offers",
});

assert.deepEqual(defaultNavForSurface("business"), {
  afterSubmitListPath: "/business/places",
});

assert.equal(
  resolveEditorReturnDestination({
    surface: "business",
    entity: "event",
    currentHost: "mamago.by",
    currentProtocol: "https",
  }),
  "https://business.mamago.by/events",
);

assert.equal(
  resolveEditorReturnDestination({
    surface: "admin",
    entity: "offer",
    returnTo: "/business/offers?view=archived",
    currentHost: "admin.mamago.by",
    currentProtocol: "https",
  }),
  "https://business.mamago.by/offers?view=archived",
);

assert.equal(
  resolveEditorReturnDestination({
    surface: "business",
    entity: "place",
    returnTo: "/business/places",
    currentHost: "localhost:3000",
    currentProtocol: "http",
  }),
  "/business/places",
);

assert.equal(
  resolveEditorReturnDestination({
    surface: "business",
    entity: "place",
    returnTo: "https://example.com/custom-return",
  }),
  "https://example.com/custom-return",
);

console.log("content editor routing tests: OK");
