import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// --- Regression guard: the external weather call (getHeroContext) must live
// inside a Suspense boundary, not in the awaited chain that produces the
// main sections (kuda/routes/articles/classes). This pins the P0 fix that
// stops a slow/unavailable Open-Meteo from delaying the whole page. ---

const source = fs.readFileSync(path.join(__dirname, "CityHomePage.tsx"), "utf8");

// getHeroContext must only be called inside the dedicated async section
// component, not awaited directly in the page body before the main
// Promise.all.
const heroSectionMatch = source.match(
  /async function HeroWeatherSection[\s\S]*?getHeroContext\(/,
);
assert.ok(heroSectionMatch, "getHeroContext must be called from HeroWeatherSection");

const beforeHeroSection = source.slice(0, source.indexOf("async function HeroWeatherSection"));
assert.ok(
  !beforeHeroSection.includes("getHeroContext("),
  "getHeroContext must not be awaited before HeroWeatherSection / the main Promise.all",
);

assert.ok(
  /<Suspense fallback=\{<HeroGreetingShell initialModel=\{heroFallbackModel\} \/>\}>\s*<HeroWeatherSection/.test(
    source,
  ),
  "HeroWeatherSection must be wrapped in a Suspense boundary with a deterministic fallback",
);

// Kuda ranking must use the deterministic fallback context, not the awaited
// weather model — i.e. it must not depend on HeroWeatherSection resolving.
assert.ok(
  source.includes("getFallbackHeroModel({") && /kudaPreviewPromise = userPromise\.then/.test(source),
  "Kuda ranking context must come from the deterministic fallback, not a blocking weather await",
);

console.log("CityHomePage weather-non-blocking test: OK");
