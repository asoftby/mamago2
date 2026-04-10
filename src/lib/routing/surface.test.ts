import assert from "node:assert/strict";

import {
  ADMIN_PATH_PREFIX,
  BUSINESS_PATH_PREFIX,
  buildAdminPath,
  buildBusinessPath,
  buildPublicPath,
  resolveSurfaceFromHostAndPathname,
  surfaceFromPathname,
} from "./surface";

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

console.log("surface routing tests: OK");
