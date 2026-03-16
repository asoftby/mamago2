#!/usr/bin/env tsx

/**
 * Test: Event Location API Integration
 * Tests the actual API endpoints for districts, metro, and enrichment
 */

async function testAPI() {
  console.log("🧪 Testing Event Location API Integration\n");

  const baseUrl = "http://localhost:3000";

  // Test 1: Load districts for Minsk
  console.log("1. Testing districts API...");
  try {
    const response = await fetch(`${baseUrl}/api/geo/districts?citySlug=minsk`);
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Districts loaded:", data.districts?.length || 0);
      if (data.districts?.length > 0) {
        console.log("   Sample district:", data.districts[0]);
      }
    } else {
      console.log("❌ Districts API failed:", response.status, response.statusText);
    }
  } catch (err) {
    console.log("❌ Districts API error:", err.message);
  }

  // Test 2: Load metro stations for Minsk
  console.log("\n2. Testing metro stations API...");
  try {
    const response = await fetch(`${baseUrl}/api/geo/metro-stations?citySlug=minsk`);
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Metro stations loaded:", data.metroStations?.length || 0);
      if (data.metroStations?.length > 0) {
        console.log("   Sample metro station:", data.metroStations[0]);
      }
    } else {
      console.log("❌ Metro stations API failed:", response.status, response.statusText);
    }
  } catch (err) {
    console.log("❌ Metro stations API error:", err.message);
  }

  // Test 3: Enrich location (Minsk coordinates)
  console.log("\n3. Testing location enrichment API...");
  try {
    const response = await fetch(`${baseUrl}/api/geo/enrich-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 53.9045,
        lng: 27.5615,
        formattedAddr: "Притыцкого 12, Минск, Беларусь",
        addressJson: [],
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Location enriched successfully:");
      console.log("   City:", data.cityName, `(${data.cityId})`);
      console.log("   District:", data.districtName, `(${data.districtAutoId})`);
      console.log("   Metro:", data.metroName, `(${data.metroAutoId})`, 
                  data.metroAutoDistanceM ? `${data.metroAutoDistanceM}m` : '');
    } else {
      console.log("❌ Enrichment API failed:", response.status, response.statusText);
      const errorText = await response.text();
      console.log("   Error:", errorText);
    }
  } catch (err) {
    console.log("❌ Enrichment API error:", err.message);
  }

  console.log("\n🎉 API Test completed!");
  console.log("\nTo run this test:");
  console.log("1. Start the development server: npm run dev");
  console.log("2. Run this script: npx tsx scripts/test-event-location-api.ts");
}

testAPI().catch(console.error);