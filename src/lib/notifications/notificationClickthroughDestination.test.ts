import assert from "node:assert/strict";

import { resolveNotificationClickthroughDestination } from "./notificationClickthroughDestination";

assert.equal(
  resolveNotificationClickthroughDestination({
    destination: "/me/plan",
    currentHost: "admin.mamago.by",
    currentProtocol: "https:",
  }),
  "https://mamago.by/me/plan",
);

assert.equal(
  resolveNotificationClickthroughDestination({
    destination: "/me/bookings",
    currentHost: "business.dev.mamago.by",
    currentProtocol: "https:",
  }),
  "https://dev.mamago.by/me/bookings",
);

assert.equal(
  resolveNotificationClickthroughDestination({
    destination: "/business/offers/offer_123/edit",
    currentHost: "admin.mamago.by",
    currentProtocol: "https:",
  }),
  "https://business.mamago.by/offers/offer_123/edit",
);

assert.equal(
  resolveNotificationClickthroughDestination({
    destination: "/admin/moderation/queue",
    currentHost: "business.dev.mamago.by",
    currentProtocol: "https:",
  }),
  "https://admin.dev.mamago.by/moderation/queue",
);

assert.equal(
  resolveNotificationClickthroughDestination({
    destination: "/admin/b2b/requests?status=PENDING&open=req_123",
    currentHost: "admin.mamago.by",
    currentProtocol: "https:",
  }),
  "https://admin.mamago.by/b2b/requests?status=PENDING&open=req_123",
);

assert.equal(
  resolveNotificationClickthroughDestination({
    destination: "https://example.com/help",
    currentHost: "admin.mamago.by",
    currentProtocol: "https:",
  }),
  "https://example.com/help",
);

assert.equal(
  resolveNotificationClickthroughDestination({
    destination: "//evil.example/path",
    currentHost: "admin.mamago.by",
    currentProtocol: "https:",
  }),
  null,
);

console.log("notification click-through destination tests: OK");
