import assert from "node:assert/strict";
import { resolveLegacyProdPreviewRedirect } from "./subdomainMiddleware";

assert.equal(
  resolveLegacyProdPreviewRedirect({
    host: "prod.mamago.by",
    pathname: "/",
    search: "",
  }),
  "https://mamago.by/minsk",
);

assert.equal(
  resolveLegacyProdPreviewRedirect({
    host: "prod.mamago.by",
    pathname: "/minsk/events/family-day",
    search: "?utm_source=legacy",
  }),
  "https://mamago.by/minsk/events/family-day?utm_source=legacy",
);

assert.equal(
  resolveLegacyProdPreviewRedirect({
    host: "prod.mamago.by:443",
    pathname: "/blog",
    search: "",
  }),
  "https://mamago.by/blog",
);

for (const host of [
  "mamago.by",
  "dev.mamago.by",
  "admin.prod.mamago.by",
  "business.prod.mamago.by",
]) {
  assert.equal(
    resolveLegacyProdPreviewRedirect({ host, pathname: "/minsk", search: "" }),
    null,
    `${host} must not be redirected by the legacy public PROD host rule`,
  );
}

console.log("legacy prod preview redirect tests: OK");
