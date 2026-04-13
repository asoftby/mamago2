import assert from "node:assert/strict";

import {
  ADMIN_PATH_PREFIX,
  BUSINESS_PATH_PREFIX,
  buildAdminPath,
  buildBusinessPath,
  buildPublicPath,
  buildSurfaceRedirectDestination,
  resolveSurfaceFromHostAndPathname,
  surfaceFromPathname,
} from "./surface.ts";

assert.equal(surfaceFromPathname("/admin"), "admin");
assert.equal(surfaceFromPathname("/admin/users"), "admin");
assert.equal(surfaceFromPathname("/business"), "business");
assert.equal(surfaceFromPathname("/business/dashboard"), "business");
assert.equal(surfaceFromPathname("/administration"), "public");
assert.equal(surfaceFromPathname("/me"), "public");

assert.equal(
  resolveSurfaceFromHostAndPathname("admin.example.com", "/me"),
  "public",
);
assert.equal(resolveSurfaceFromHostAndPathname(undefined, "/admin"), "admin");
assert.equal(
  resolveSurfaceFromHostAndPathname("admin.mamago.local:3000", "/"),
  "admin",
);
assert.equal(
  resolveSurfaceFromHostAndPathname("business.mamago.by", "/dashboard"),
  "business",
);
assert.equal(
  resolveSurfaceFromHostAndPathname("mamago.local:3000", "/"),
  "public",
);

assert.equal(buildAdminPath(""), `${ADMIN_PATH_PREFIX}/`);
assert.equal(buildAdminPath("/users"), `${ADMIN_PATH_PREFIX}/users`);
assert.equal(buildAdminPath("users"), `${ADMIN_PATH_PREFIX}/users`);

assert.equal(
  buildBusinessPath("/dashboard"),
  `${BUSINESS_PATH_PREFIX}/dashboard`,
);
assert.equal(buildBusinessPath("places"), `${BUSINESS_PATH_PREFIX}/places`);

assert.equal(buildPublicPath(""), "/");
assert.equal(buildPublicPath("/"), "/");
assert.equal(buildPublicPath("/me/plan"), "/me/plan");
assert.equal(buildPublicPath("me"), "/me");

assert.equal(
  buildSurfaceRedirectDestination({
    targetSurface: "public",
    targetPath: "/login?from=admin",
    currentHost: "admin.mamago.by",
    currentProtocol: "https",
  }),
  "https://mamago.by/login?from=admin",
);

assert.equal(
  buildSurfaceRedirectDestination({
    targetSurface: "admin",
    targetPath: "/",
    currentHost: "business.mamago.by",
    currentProtocol: "https",
  }),
  "https://admin.mamago.by/",
);

assert.equal(
  buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/dashboard",
    currentHost: "mamago.local:3002",
    currentProtocol: "http",
  }),
  "http://business.mamago.local:3002/dashboard",
);

assert.equal(
  buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/dashboard",
    currentHost: "localhost:3000",
    currentProtocol: "http",
  }),
  "/business/dashboard",
);

assert.equal(
  buildSurfaceRedirectDestination({
    targetSurface: "public",
    targetPath: "/profile",
    currentHost: "preview.example.com",
    currentProtocol: "https",
  }),
  "/profile",
);

console.log("surface routing tests: OK");
