#!/usr/bin/env tsx

/**
 * Test API with CUID
 * Tests the API endpoints using the actual CUID from database
 */

import { NextRequest } from "next/server";
import { GET as getDistricts } from "../../src/app/api/geo/districts/route.js";
import { GET as getMetroStations } from "../../src/app/api/geo/metro-stations/route.js";

async function testAPIWithCUID() {
  console.log("🧪 Testing API with CUID from Database\n");

  const minskCUID = "cmmj3p3uh0011ws3mmxhskmsf";

  // Test 1: Districts API with CUID
  console.log("1. Testing districts API with CUID...");
  try {
    const url = new URL(`http://localhost:3000/api/geo/districts?cityId=${minskCUID}`);
    const request = new NextRequest(url);
    const response = await getDistricts(request);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log("✅ Districts API with CUID works:", data.districts?.length || 0, "districts");
      if (data.districts?.length > 0) {
        console.log("   Sample:", data.districts[0]);
      }
    } else {
      console.log("❌ Districts API with CUID failed:", response.status);
      const errorText = await response.text();
      console.log("   Error:", errorText);
    }
  } catch (err) {
    console.log("❌ Districts API with CUID error:", err.message);
  }

  // Test 2: Metro Stations API with CUID
  console.log("\n2. Testing metro stations API with CUID...");
  try {
    const url = new URL(`http://localhost:3000/api/geo/metro-stations?cityId=${minskCUID}`);
    const request = new NextRequest(url);
    const response = await getMetroStations(request);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log("✅ Metro stations API with CUID works:", data.metroStations?.length || 0, "stations");
      if (data.metroStations?.length > 0) {
        console.log("   Sample:", data.metroStations[0]);
      }
    } else {
      console.log("❌ Metro stations API with CUID failed:", response.status);
      const errorText = await response.text();
      console.log("   Error:", errorText);
    }
  } catch (err) {
    console.log("❌ Metro stations API with CUID error:", err.message);
  }

  // Test 3: Compare slug vs CUID
  console.log("\n3. Comparing slug vs CUID results...");
  
  try {
    // Test with slug
    const slugUrl = new URL("http://localhost:3000/api/geo/districts?citySlug=minsk");
    const slugRequest = new NextRequest(slugUrl);
    const slugResponse = await getDistricts(slugRequest);
    const slugData = slugResponse.status === 200 ? await slugResponse.json() : null;
    
    // Test with CUID
    const cuidUrl = new URL(`http://localhost:3000/api/geo/districts?cityId=${minskCUID}`);
    const cuidRequest = new NextRequest(cuidUrl);
    const cuidResponse = await getDistricts(cuidRequest);
    const cuidData = cuidResponse.status === 200 ? await cuidResponse.json() : null;
    
    console.log("   Slug result:", slugData?.districts?.length || 0, "districts");
    console.log("   CUID result:", cuidData?.districts?.length || 0, "districts");
    
    if (slugData?.districts?.length === cuidData?.districts?.length) {
      console.log("✅ Both slug and CUID return same number of districts");
    } else {
      console.log("❌ Slug and CUID return different results");
    }
    
  } catch (err) {
    console.log("❌ Comparison error:", err.message);
  }

  console.log("\n🎉 API with CUID Test completed!");
}

testAPIWithCUID().catch(console.error);