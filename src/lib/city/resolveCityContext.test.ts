import assert from "node:assert/strict";
import { DEFAULT_CITY_SLUG, resolveCityContext } from "./resolveCityContext";

{
  const resolved = resolveCityContext({ pathname: "/minsk" });
  assert.equal(resolved.citySlug, "minsk");
  assert.equal(resolved.source, "route");
  assert.equal(resolved.isCityRoute, true);
}

{
  const resolved = resolveCityContext({ pathname: "/minsk/kuda" });
  assert.equal(resolved.citySlug, "minsk");
  assert.equal(resolved.source, "route");
}

{
  const resolved = resolveCityContext({
    pathname: "/me/ideas",
    preferredCitySlug: "marina-gorka",
  });
  assert.equal(resolved.citySlug, "marina-gorka");
  assert.equal(resolved.source, "preference");
  assert.equal(resolved.isCityRoute, false);
}

{
  const resolved = resolveCityContext({ pathname: "/me/plan", preferredCitySlug: null });
  assert.equal(resolved.citySlug, DEFAULT_CITY_SLUG);
  assert.equal(resolved.source, "default");
}

{
  const resolved = resolveCityContext({ pathname: "/admin", preferredCitySlug: "minsk" });
  assert.equal(resolved.citySlug, "minsk");
  assert.equal(resolved.source, "preference");
}

{
  const resolved = resolveCityContext({
    pathname: "/business/dashboard",
    preferredCitySlug: "minsk",
  });
  assert.equal(resolved.citySlug, "minsk");
}

{
  const resolved = resolveCityContext({ pathname: "/marina-gorka/events" });
  assert.equal(resolved.citySlug, "marina-gorka");
  assert.equal(resolved.source, "route");
}

{
  const resolved = resolveCityContext({
    pathname: "/unknown-city/events",
    preferredCitySlug: "minsk",
  });
  assert.equal(resolved.citySlug, "minsk");
  assert.equal(resolved.source, "preference");
}

{
  const resolved = resolveCityContext({ pathname: null, preferredCitySlug: null });
  assert.equal(resolved.citySlug, DEFAULT_CITY_SLUG);
  assert.equal(resolved.source, "default");
}

console.log("resolveCityContext tests: OK");
