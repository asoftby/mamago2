/**
 * Debug script to test city resolution from different paths
 */

import { getCityFromPath, getIntentFromPath } from "../../src/lib/intent";

const testPaths = [
  "/",
  "/minsk",
  "/minsk/classes",
  "/minsk/birthday",
  "/minsk/routes",
  "/minsk/activity/2",
  "/minsk/activity",
  "/me",
  "/login",
  "/places/some-slug",
];

console.log("=== City & Intent Resolution Debug ===\n");

testPaths.forEach(path => {
  const city = getCityFromPath(path);
  const intent = getIntentFromPath(path);
  const shouldShowFilters = city && intent;
  
  console.log(`Path: ${path}`);
  console.log(`  City: ${city}`);
  console.log(`  Intent: ${intent}`);
  console.log(`  Show Filters: ${shouldShowFilters ? 'YES ✅' : 'NO ❌'}`);
  console.log("");
});

console.log("=== Expected Behavior ===");
console.log("Filters should ONLY show on:");
console.log("  ✅ /minsk (kuda)");
console.log("  ✅ /minsk/classes");
console.log("  ✅ /minsk/birthday");
console.log("  ❌ /minsk/routes (hasFilters: false)");
console.log("\nFilters should NOT show on:");
console.log("  ❌ /minsk/activity/2 (detail page)");
console.log("  ❌ /minsk/activity (not a valid intent)");
console.log("  ❌ /me, /login, /places/* (no city)");
