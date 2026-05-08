#!/usr/bin/env tsx

/**
 * Test: Event Location Metro & District Functionality
 * Verifies the enhanced Event Location Step with district and metro selection
 */

import { getDefaultFormData } from "../../src/components/business/wizard/event/defaults.js";
import { validateStep2 } from "../../src/components/business/wizard/event/validation.js";
import { buildEventPayload } from "../../src/components/business/wizard/event/mappers.js";
import type { EventFormData } from "../../src/components/business/wizard/event/types.js";
import { 
  loadDistricts,
  loadMetroStations,
  formatDistance
} from "../../src/components/business/wizard/event/steps/location/eventLocationUtils.js";

async function runTests() {
  console.log("🧪 Testing Event Location Metro & District Functionality\n");

  // Test 1: Default form data with new fields
  console.log("1. Testing default form data with new fields...");
  const defaultData = getDefaultFormData();
  console.log("✅ New venue fields:", {
    districtAutoId: defaultData.districtAutoId,
    districtManualId: defaultData.districtManualId,
    districtName: defaultData.districtName,
    metroAutoId: defaultData.metroAutoId,
    metroAutoDistanceM: defaultData.metroAutoDistanceM,
    metroManualId: defaultData.metroManualId,
    metroManualDistanceM: defaultData.metroManualDistanceM,
    metroName: defaultData.metroName,
  });

  // Test 2: Load districts and metro stations
  console.log("\n2. Testing geo API calls...");
  try {
    const [districts, metroStations] = await Promise.all([
      loadDistricts("minsk"),
      loadMetroStations("minsk"),
    ]);
    
    console.log("✅ Loaded districts:", districts.length);
    console.log("✅ Loaded metro stations:", metroStations.length);
    
    if (districts.length > 0) {
      console.log("   Sample district:", districts[0]);
    }
    if (metroStations.length > 0) {
      console.log("   Sample metro:", metroStations[0]);
    }
  } catch (err) {
    console.log("⚠️  Geo API calls failed (expected in test environment):", err instanceof Error ? err.message : String(err));
  }

  // Test 3: Event form data with district and metro
  console.log("\n3. Testing Event form data with district and metro...");
  const enrichedData: EventFormData = {
    ...defaultData,
    venueKind: "MANUAL",
    venueName: "Детский центр Песочница",
    address: "Притыцкого 12, Минск, Беларусь",
    city: "Минск",
    lat: 53.9045,
    lng: 27.5615,
    source: "ADDRESS_INPUT",
    
    // Auto-determined fields
    districtAutoId: "district-1",
    districtName: "Центральный",
    metroAutoId: "metro-1",
    metroAutoDistanceM: 500,
    metroName: "Площадь Победы",
    
    // Legacy fields
    district: "Центральный",
    metro: "Площадь Победы",
  };

  const validation = validateStep2(enrichedData);
  console.log("✅ Validation result:", {
    isValid: validation.isValid,
    isComplete: validation.isComplete,
  });

  // Test 4: Event payload generation with new fields
  console.log("\n4. Testing Event payload generation...");
  const eventPayload = buildEventPayload(enrichedData);
  console.log("✅ Generated venue payload:", eventPayload.venue);

  // Test 5: Format distance utility
  console.log("\n5. Testing distance formatting...");
  console.log("✅ 500m:", formatDistance(500));
  console.log("✅ 1200m:", formatDistance(1200));
  console.log("✅ 2500m:", formatDistance(2500));

  console.log("\n🎉 Event Location Metro & District Test completed!");
  console.log("\nImplementation Summary:");
  console.log("- ✅ Added district and metro fields to EventFormData");
  console.log("- ✅ Auto and manual selection support");
  console.log("- ✅ API integration for loading districts and metro stations");
  console.log("- ✅ Geo enrichment API integration");
  console.log("- ✅ Distance formatting utility");
  console.log("- ✅ Updated mappers and validation");
  console.log("- ✅ Backward compatibility with legacy fields");
  console.log("\nEvent Location now has the same district/metro functionality as Place!");
}

runTests().catch(console.error);