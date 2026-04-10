#!/usr/bin/env tsx

/**
 * Test CUID Detection
 * Tests the CUID vs slug detection logic
 */

function testCUIDDetection() {
  console.log("🧪 Testing CUID Detection Logic\n");

  const testCases = [
    { input: "cmmj3p3uh0011ws3mmxhskmsf", expected: "cityId", description: "CUID from database" },
    { input: "minsk", expected: "citySlug", description: "City slug" },
    { input: "550e8400-e29b-41d4-a716-446655440000", expected: "cityId", description: "Standard UUID" },
    { input: "москва", expected: "citySlug", description: "Cyrillic slug" },
    { input: "new-york", expected: "citySlug", description: "Slug with dash" },
  ];

  testCases.forEach(testCase => {
    // CUID format: cmmj3p3uh0011ws3mmxhskmsf (25 chars, alphanumeric)
    // UUID format: 550e8400-e29b-41d4-a716-446655440000 (36 chars with dashes)
    const isCUID = /^c[a-z0-9]{24}$/i.test(testCase.input);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(testCase.input);
    const isId = isCUID || isUUID;
    
    const param = isId ? `cityId=${encodeURIComponent(testCase.input)}` : `citySlug=${encodeURIComponent(testCase.input)}`;
    const actualType = isId ? "cityId" : "citySlug";
    
    const status = actualType === testCase.expected ? "✅" : "❌";
    
    console.log(`${status} ${testCase.description}:`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.expected}, Got: ${actualType}`);
    console.log(`   Param: ${param}`);
    console.log(`   isCUID: ${isCUID}, isUUID: ${isUUID}`);
    console.log();
  });

  console.log("🎉 CUID Detection Test completed!");
}

testCUIDDetection();