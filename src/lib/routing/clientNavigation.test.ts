import assert from "node:assert/strict";

import {
  buildClientCompatibleDestination,
  buildClientSurfaceDestination,
} from "./clientNavigation";

assert.equal(
  buildClientSurfaceDestination({
    targetSurface: "admin",
    targetPath: "/",
    currentHost: "mamago.by",
    currentProtocol: "https",
  }),
  "https://admin.mamago.by/",
);

assert.equal(
  buildClientSurfaceDestination({
    targetSurface: "business",
    targetPath: "/places",
    currentHost: "admin.mamago.local:3002",
    currentProtocol: "http",
  }),
  "http://business.mamago.local:3002/places",
);

assert.equal(
  buildClientSurfaceDestination({
    targetSurface: "public",
    targetPath: "/me/plan",
    currentHost: "localhost:3000",
    currentProtocol: "http",
  }),
  "/me/plan",
);

assert.equal(
  buildClientSurfaceDestination({
    targetSurface: "business",
    targetPath: "/dashboard",
  }),
  "/business/dashboard",
);

assert.equal(
  buildClientCompatibleDestination("/business/events", {
    currentHost: "mamago.by",
    currentProtocol: "https",
  }),
  "https://business.mamago.by/events",
);

assert.equal(
  buildClientCompatibleDestination("/me", {
    currentHost: "admin.mamago.by",
    currentProtocol: "https",
  }),
  "https://mamago.by/me",
);

assert.equal(
  buildClientCompatibleDestination("/editor/place/new", {
    currentHost: "business.mamago.local:3002",
    currentProtocol: "http",
  }),
  "http://mamago.local:3002/editor/place/new",
);

assert.equal(
  buildClientCompatibleDestination("https://example.com/welcome"),
  "https://example.com/welcome",
);

console.log("client surface navigation tests: OK");
