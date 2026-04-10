import assert from "node:assert/strict";

import { buildClientSurfaceDestination } from "./clientNavigation.ts";

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

console.log("client surface navigation tests: OK");
