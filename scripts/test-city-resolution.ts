/**
 * Test city resolution pipeline
 * Tests both coordinate-based and address-based resolution
 */

import { resolveCityId } from "../src/services/place/cityResolver.service";

async function main() {
  console.log("=== TESTING CITY RESOLUTION PIPELINE ===\n");

  // Test 1: Minsk coordinates (should match)
  console.log("Test 1: Minsk city center coordinates");
  console.log("Input: lat=53.9, lng=27.5");
  const result1 = await resolveCityId({
    lat: 53.9,
    lng: 27.5,
  });
  console.log("Result:", JSON.stringify(result1, null, 2));
  console.log(result1.cityId ? "✅ PASS" : "❌ FAIL");
  console.log();

  // Test 2: Minsk address with coordinates
  console.log("Test 2: Minsk address (Мястровская 5)");
  console.log("Input: lat=53.9006, lng=27.559");
  const result2 = await resolveCityId({
    lat: 53.9006,
    lng: 27.559,
    addressJson: [
      {
        long_name: "5",
        short_name: "5",
        types: ["street_number"],
      },
      {
        long_name: "Мястровская вуліца",
        short_name: "Мястровская вуліца",
        types: ["route"],
      },
      {
        long_name: "Minsk",
        short_name: "Minsk",
        types: ["locality", "political"],
      },
      {
        long_name: "Minsk Region",
        short_name: "Minsk Region",
        types: ["administrative_area_level_1", "political"],
      },
      {
        long_name: "Belarus",
        short_name: "BY",
        types: ["country", "political"],
      },
    ],
  });
  console.log("Result:", JSON.stringify(result2, null, 2));
  console.log(result2.cityId ? "✅ PASS" : "❌ FAIL");
  console.log();

  // Test 3: Coordinates outside Minsk (should not match)
  console.log("Test 3: Coordinates outside Minsk (Gomel area)");
  console.log("Input: lat=52.4345, lng=30.9754");
  const result3 = await resolveCityId({
    lat: 52.4345,
    lng: 30.9754,
  });
  console.log("Result:", JSON.stringify(result3, null, 2));
  console.log(!result3.cityId ? "✅ PASS (correctly returned null)" : "❌ FAIL");
  console.log();

  // Test 4: Edge of Minsk radius
  console.log("Test 4: Edge of Minsk radius (~39km from center)");
  console.log("Input: lat=53.55, lng=27.5");
  const result4 = await resolveCityId({
    lat: 53.55,
    lng: 27.5,
  });
  console.log("Result:", JSON.stringify(result4, null, 2));
  console.log(result4.cityId ? "✅ PASS" : "❌ FAIL");
  console.log();

  // Summary
  console.log("\n=== SUMMARY ===");
  const tests = [result1, result2, result4];
  const passed = tests.filter((r) => r.cityId).length;
  console.log(`Passed: ${passed}/${tests.length + 1} tests`);
  
  if (passed === tests.length && !result3.cityId) {
    console.log("✅ All tests passed!");
  } else {
    console.log("❌ Some tests failed");
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
