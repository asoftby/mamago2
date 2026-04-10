#!/usr/bin/env tsx

/**
 * Test filter API endpoints
 */

async function testFilterAPI() {
  console.log("🔍 Testing Filter API Endpoints");
  
  const baseUrl = "http://localhost:3000";
  
  try {
    // Test metro stations API
    console.log("\n📍 Testing metro stations API...");
    const metroResponse = await fetch(`${baseUrl}/api/geo/metro-stations?citySlug=minsk`);
    
    if (metroResponse.ok) {
      const metroData = await metroResponse.json();
      console.log(`✅ Metro stations: ${metroData.metroStations?.length || 0} stations found`);
      if (metroData.metroStations?.length > 0) {
        console.log(`   First station: ${metroData.metroStations[0].name}`);
      }
    } else {
      console.log(`❌ Metro stations API failed: ${metroResponse.status} ${metroResponse.statusText}`);
    }
    
    // Test districts API
    console.log("\n🏘️ Testing districts API...");
    const districtsResponse = await fetch(`${baseUrl}/api/geo/districts?citySlug=minsk`);
    
    if (districtsResponse.ok) {
      const districtsData = await districtsResponse.json();
      console.log(`✅ Districts: ${districtsData.districts?.length || 0} districts found`);
      if (districtsData.districts?.length > 0) {
        console.log(`   First district: ${districtsData.districts[0].name}`);
      }
    } else {
      console.log(`❌ Districts API failed: ${districtsResponse.status} ${districtsResponse.statusText}`);
    }
    
    // Test with invalid city
    console.log("\n❓ Testing with invalid city...");
    const invalidResponse = await fetch(`${baseUrl}/api/geo/metro-stations?citySlug=invalid`);
    
    if (invalidResponse.status === 404) {
      console.log("✅ Invalid city properly returns 404");
    } else {
      console.log(`❌ Invalid city returned unexpected status: ${invalidResponse.status}`);
    }
    
    console.log("\n🎉 Filter API tests completed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testFilterAPI();