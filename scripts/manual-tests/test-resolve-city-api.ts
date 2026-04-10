/**
 * Test: /api/geo/resolve-city endpoint
 * 
 * Tests the new lightweight city resolution API
 */

// Sample data from Google Places for Minsk address
const testCases = [
  {
    name: "Minsk address (Belarusian)",
    lat: 53.9045,
    lng: 27.5615,
    addressJson: [
      { long_name: "5", short_name: "5", types: ["street_number"] },
      { long_name: "вуліца Мястроўская", short_name: "вул. Мястроўская", types: ["route"] },
      { long_name: "Мінск", short_name: "Мінск", types: ["locality", "political"] },
      { long_name: "Беларусь", short_name: "BY", types: ["country", "political"] }
    ],
    expectedCity: "Минск",
  },
  {
    name: "Minsk coordinates only (no addressJson)",
    lat: 53.9,
    lng: 27.5,
    addressJson: null,
    expectedCity: "Минск",
  },
  {
    name: "Outside all cities",
    lat: 60.0,
    lng: 30.0,
    addressJson: null,
    expectedCity: null,
  },
];

async function testResolveCityAPI() {
  console.log("=".repeat(80));
  console.log("TEST: /api/geo/resolve-city API");
  console.log("=".repeat(80));
  console.log();

  const baseUrl = "http://localhost:3002";
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log("-".repeat(80));
    console.log(`  Coordinates: ${testCase.lat}, ${testCase.lng}`);
    console.log(`  Has addressJson: ${!!testCase.addressJson}`);
    console.log(`  Expected city: ${testCase.expectedCity || "null"}`);

    try {
      const response = await fetch(`${baseUrl}/api/geo/resolve-city`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: testCase.lat,
          lng: testCase.lng,
          addressJson: testCase.addressJson,
        }),
      });

      if (!response.ok) {
        console.log(`  ❌ FAILED: HTTP ${response.status}`);
        failed++;
        continue;
      }

      const result = await response.json();
      console.log(`  Result: cityId=${result.cityId || "null"}, cityName=${result.cityName || "null"}`);

      if (testCase.expectedCity === null) {
        if (result.cityId === null) {
          console.log(`  ✅ PASSED: Correctly returned null`);
          passed++;
        } else {
          console.log(`  ❌ FAILED: Expected null but got ${result.cityName}`);
          failed++;
        }
      } else {
        if (result.cityName === testCase.expectedCity) {
          console.log(`  ✅ PASSED: Correctly resolved ${result.cityName}`);
          passed++;
        } else {
          console.log(`  ❌ FAILED: Expected ${testCase.expectedCity} but got ${result.cityName || "null"}`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }

    console.log();
  }

  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Passed: ${passed}/${testCases.length}`);
  console.log(`Failed: ${failed}/${testCases.length}`);
  console.log();

  if (failed === 0) {
    console.log("✅ ALL TESTS PASSED");
  } else {
    console.log("❌ SOME TESTS FAILED");
    process.exit(1);
  }
}

testResolveCityAPI().catch((error) => {
  console.error("Test error:", error);
  process.exit(1);
});
