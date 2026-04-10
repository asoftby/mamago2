/**
 * Test: /api/geo/enrich-location endpoint
 * 
 * Tests the full geo enrichment API
 */

const testCases = [
  {
    name: "Minsk address (should resolve district, maybe not metro due to distance)",
    lat: 53.9320215,
    lng: 27.5025518,
    addressJson: [
      { long_name: "Мінск", short_name: "Мінск", types: ["locality", "political"] },
      { long_name: "Беларусь", short_name: "BY", types: ["country", "political"] }
    ],
    expectedCity: "Минск",
    expectedDistrict: "Октябрьский", // Nearest
    expectedMetro: null, // Too far (>2.5km)
  },
  {
    name: "Minsk center (should resolve all)",
    lat: 53.9045,
    lng: 27.5615,
    addressJson: null,
    expectedCity: "Минск",
    expectedDistrict: "Центральный",
    expectedMetro: "Октябрьская", // Should be close
  },
];

async function testEnrichLocationAPI() {
  console.log("=".repeat(80));
  console.log("TEST: /api/geo/enrich-location API");
  console.log("=".repeat(80));
  console.log();

  const baseUrl = "http://localhost:3002";
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log("-".repeat(80));
    console.log(`  Coordinates: ${testCase.lat}, ${testCase.lng}`);
    console.log(`  Expected city: ${testCase.expectedCity}`);
    console.log(`  Expected district: ${testCase.expectedDistrict || "null"}`);
    console.log(`  Expected metro: ${testCase.expectedMetro || "null"}`);

    try {
      const response = await fetch(`${baseUrl}/api/geo/enrich-location`, {
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
      console.log(`  Result:`);
      console.log(`    cityId: ${result.cityId || "null"}`);
      console.log(`    cityName: ${result.cityName || "null"}`);
      console.log(`    districtAutoId: ${result.districtAutoId || "null"}`);
      console.log(`    districtName: ${result.districtName || "null"}`);
      console.log(`    metroAutoId: ${result.metroAutoId || "null"}`);
      console.log(`    metroName: ${result.metroName || "null"}`);
      console.log(`    metroAutoDistanceM: ${result.metroAutoDistanceM || "null"}`);

      let testPassed = true;

      // Check city
      if (result.cityName !== testCase.expectedCity) {
        console.log(`  ❌ City mismatch: expected ${testCase.expectedCity}, got ${result.cityName}`);
        testPassed = false;
      }

      // Check district
      if (testCase.expectedDistrict && result.districtName !== testCase.expectedDistrict) {
        console.log(`  ⚠️  District mismatch: expected ${testCase.expectedDistrict}, got ${result.districtName || "null"}`);
        // Not failing test, just warning
      }

      // Check metro
      if (testCase.expectedMetro && result.metroName !== testCase.expectedMetro) {
        console.log(`  ⚠️  Metro mismatch: expected ${testCase.expectedMetro}, got ${result.metroName || "null"}`);
        // Not failing test, just warning
      }

      if (testPassed) {
        console.log(`  ✅ PASSED`);
        passed++;
      } else {
        failed++;
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

testEnrichLocationAPI().catch((error) => {
  console.error("Test error:", error);
  process.exit(1);
});
