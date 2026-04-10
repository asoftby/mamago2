#!/usr/bin/env tsx

/**
 * Test Geo API Endpoints Directly
 * Tests the API endpoints without going through the browser
 */

import { NextRequest } from "next/server";
import { GET as getDistricts } from "../../src/app/api/geo/districts/route.js";
import { GET as getMetroStations } from "../../src/app/api/geo/metro-stations/route.js";
import { POST as enrichLocation } from "../../src/app/api/geo/enrich-location/route.js";

async function testGeoAPIDirect() {
  console.log("🧪 Testing Geo API Endpoints Directly\n");

  // Test 1: Districts API
  console.log("1. Testing districts API...");
  try {
    const url = new URL("http://localhost:3000/api/geo/districts?citySlug=minsk");
    const request = new NextRequest(url);
    const response = await getDistricts(request);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log("✅ Districts API works:", data.districts?.length || 0, "districts");
      if (data.districts?.length > 0) {
        console.log("   Sample:", data.districts[0]);
      }
    } else {
      console.log("❌ Districts API failed:", response.status);
      const errorText = await response.text();
      console.log("   Error:", errorText);
    }
  } catch (err) {
    console.log("❌ Districts API error:", err.message);
  }

  // Test 2: Metro Stations API
  console.log("\n2. Testing metro stations API...");
  try {
    const url = new URL("http://localhost:3000/api/geo/metro-stations?citySlug=minsk");
    const request = new NextRequest(url);
    const response = await getMetroStations(request);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log("✅ Metro stations API works:", data.metroStations?.length || 0, "stations");
      if (data.metroStations?.length > 0) {
        console.log("   Sample:", data.metroStations[0]);
      }
    } else {
      console.log("❌ Metro stations API failed:", response.status);
      const errorText = await response.text();
      console.log("   Error:", errorText);
    }
  } catch (err) {
    console.log("❌ Metro stations API error:", err.message);
  }

  // Test 3: Enrich Location API
  console.log("\n3. Testing enrich location API...");
  try {
    const url = new URL("http://localhost:3000/api/geo/enrich-location");
    const request = new NextRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 53.9045,
        lng: 27.5615,
        formattedAddr: "Притыцкого 12, Минск, Беларусь",
        addressJson: [],
      }),
    });
    
    const response = await enrichLocation(request);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log("✅ Enrich location API works:");
      console.log("   City:", data.cityName, `(${data.cityId})`);
      console.log("   District:", data.districtName, `(${data.districtAutoId})`);
      console.log("   Metro:", data.metroName, `(${data.metroAutoId})`, 
                  data.metroAutoDistanceM ? `${data.metroAutoDistanceM}m` : '');
    } else {
      console.log("❌ Enrich location API failed:", response.status);
      const errorText = await response.text();
      console.log("   Error:", errorText);
    }
  } catch (err) {
    console.log("❌ Enrich location API error:", err.message);
  }

  console.log("\n🎉 Direct API Test completed!");
}

testGeoAPIDirect().catch(console.error);