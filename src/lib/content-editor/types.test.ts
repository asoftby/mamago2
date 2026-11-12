import assert from "node:assert/strict";

import {
  defaultEditorNav,
  defaultNavForSurface,
  resolveEditorReturnDestination,
} from "./types";

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

// Business subdomain links are host-relative; the editor must not send them
// to public dev.mamago.by/publications/events after saving an event.
assert.equal(
  resolveEditorReturnDestination({
    surface: "business",
    entity: "event",
    returnTo: "/publications/events?status=published",
    currentHost: "dev.mamago.by",
    currentProtocol: "https",
  }),
  "https://business.dev.mamago.by/publications/events?status=published",
);
assert.equal(
  resolveEditorReturnDestination({
    surface: "business",
    entity: "event",
    returnTo: "/minsk/events/event-slug",
    currentHost: "dev.mamago.by",
    currentProtocol: "https",
  }),
  "https://dev.mamago.by/minsk/events/event-slug",
);
assert.equal(
  resolveEditorReturnDestination({
    surface: "business",
    entity: "event",
    returnTo: "/business/publications/events",
    currentHost: "localhost:3000",
  }),
  "/business/publications/events",
);

console.log("content editor routing tests: OK");
