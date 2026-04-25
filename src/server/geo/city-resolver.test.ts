/**
 * Unit tests for city-resolver.ts
 *
 * Запуск: npx tsx src/server/geo/city-resolver.test.ts
 */

import { resolveCityFromComponents, isCityNameAllowed, canAutoCreateCity } from "./city-resolver";
import type { AddressComponent } from "./city-resolver";

// ─── Simple test runner ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${(e as Error).message}`);
    failed++;
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThanOrEqual(n: number) {
      if (typeof actual !== "number" || actual < n) {
        throw new Error(`Expected >= ${n}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== "number" || actual <= n) {
        throw new Error(`Expected > ${n}, got ${JSON.stringify(actual)}`);
      }
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeComponent(longName: string, types: string[]): AddressComponent {
  return { long_name: longName, short_name: longName, types };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\n🧪 city-resolver tests\n");

console.log("resolveCityFromComponents:");

test("resolves Minsk from locality, ignores Minskaya Oblast", () => {
  const components: AddressComponent[] = [
    makeComponent("Минск", ["locality", "political"]),
    makeComponent("Минская область", ["administrative_area_level_1", "political"]),
    makeComponent("Беларусь", ["country", "political"]),
  ];
  const result = resolveCityFromComponents(components, "Минск, пр. Независимости, 50");
  expect(result.citySlug).toBe("minsk");
  expect(result.cityName).toBe("Минск");
  expect(result.needsReview).toBe(false);
  expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  expect(result.source).toBe("locality");
});

test("rejects Minskaya Oblast as city, returns needsReview=true", () => {
  const components: AddressComponent[] = [
    makeComponent("Минская область", ["administrative_area_level_1", "political"]),
    makeComponent("Беларусь", ["country", "political"]),
  ];
  const result = resolveCityFromComponents(components, "Минская область, Беларусь");
  expect(result.citySlug).toBeNull();
  expect(result.cityName).toBeNull();
  expect(result.needsReview).toBe(true);
  expect(result.rejectedCandidates.length).toBeGreaterThan(0);
});

test("resolves Grodno from locality, ignores Grodnenskaya Oblast", () => {
  const components: AddressComponent[] = [
    makeComponent("Гродно", ["locality", "political"]),
    makeComponent("Гродненская область", ["administrative_area_level_1", "political"]),
    makeComponent("Беларусь", ["country", "political"]),
  ];
  const result = resolveCityFromComponents(components, "Гродно, ул. Советская, 10");
  expect(result.citySlug).toBe("grodno");
  expect(result.needsReview).toBe(false);
  expect(result.source).toBe("locality");
});

test("rejects Grodnenskaya Oblast as city", () => {
  const components: AddressComponent[] = [
    makeComponent("Гродненская область", ["administrative_area_level_1", "political"]),
    makeComponent("Беларусь", ["country", "political"]),
  ];
  const result = resolveCityFromComponents(components, "Гродненская область, Беларусь");
  expect(result.citySlug).toBeNull();
  expect(result.needsReview).toBe(true);
});

test("resolves Minsk from English locality name", () => {
  const components: AddressComponent[] = [
    makeComponent("Minsk", ["locality", "political"]),
    makeComponent("Minsk Region", ["administrative_area_level_1", "political"]),
  ];
  const result = resolveCityFromComponents(components, "Minsk, Independence Ave, 50");
  expect(result.citySlug).toBe("minsk");
  expect(result.needsReview).toBe(false);
});

test("rejects administrative_area_level_2 as city source", () => {
  const components: AddressComponent[] = [
    makeComponent("Минский район", ["administrative_area_level_2", "political"]),
    makeComponent("Минская область", ["administrative_area_level_1", "political"]),
  ];
  const result = resolveCityFromComponents(components);
  expect(result.citySlug).toBeNull();
  expect(result.needsReview).toBe(true);
});

test("resolves city from postal_town when no locality", () => {
  const components: AddressComponent[] = [
    makeComponent("Брест", ["postal_town"]),
    makeComponent("Брестская область", ["administrative_area_level_1", "political"]),
  ];
  const result = resolveCityFromComponents(components);
  expect(result.citySlug).toBe("brest");
  expect(result.source).toBe("postal_town");
  expect(result.confidence).toBeGreaterThanOrEqual(0.8);
});

test("resolves city from formattedAddress whitelist fallback", () => {
  const components: AddressComponent[] = [
    makeComponent("Беларусь", ["country", "political"]),
  ];
  const result = resolveCityFromComponents(components, "Витебск, ул. Ленина, 5");
  expect(result.citySlug).toBe("vitebsk");
  expect(result.source).toBe("whitelist");
});

console.log("\nisCityNameAllowed:");

test("allows Минск", () => expect(isCityNameAllowed("Минск")).toBe(true));
test("allows Гродно", () => expect(isCityNameAllowed("Гродно")).toBe(true));
test("allows Minsk", () => expect(isCityNameAllowed("Minsk")).toBe(true));
test("rejects Минская область", () => expect(isCityNameAllowed("Минская область")).toBe(false));
test("rejects Гродненская область", () => expect(isCityNameAllowed("Гродненская область")).toBe(false));
test("rejects Minsk Region", () => expect(isCityNameAllowed("Minsk Region")).toBe(false));
test("rejects Minsk Oblast", () => expect(isCityNameAllowed("Minsk Oblast")).toBe(false));
test("rejects Минский район", () => expect(isCityNameAllowed("Минский район")).toBe(false));
test("rejects empty string", () => expect(isCityNameAllowed("")).toBe(false));

console.log("\ncanAutoCreateCity:");

test("allows auto-create for high-confidence locality", () => {
  const result = resolveCityFromComponents([makeComponent("Минск", ["locality", "political"])]);
  expect(canAutoCreateCity(result)).toBe(true);
});

test("denies auto-create for administrative region", () => {
  const result = resolveCityFromComponents([
    makeComponent("Минская область", ["administrative_area_level_1", "political"]),
  ]);
  expect(canAutoCreateCity(result)).toBe(false);
});

test("denies auto-create when no components", () => {
  const result = resolveCityFromComponents([]);
  expect(canAutoCreateCity(result)).toBe(false);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
