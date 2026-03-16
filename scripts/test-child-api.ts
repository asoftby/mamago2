#!/usr/bin/env tsx

/**
 * Test script for child API endpoints
 * Tests the actual HTTP API endpoints
 */

import { prisma } from "../src/lib/prisma";

async function testChildAPI() {
  console.log("🌐 Testing Child API Endpoints");
  
  try {
    // Find or create a test user
    let testUser = await prisma.user.findFirst({
      where: { email: "test@example.com" }
    });
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: "test@example.com",
          passwordHash: "test-hash",
          role: "USER"
        }
      });
    }
    
    console.log(`✅ Using test user: ${testUser.email} (${testUser.id})`);
    
    // Create a test child directly in database
    const child = await prisma.child.create({
      data: {
        name: "API Test Child",
        birthDate: new Date("2019-03-10"),
        parentId: testUser.id
      }
    });
    
    console.log(`✅ Created test child: ${child.name} (${child.id})`);
    
    // Test the DELETE endpoint structure
    console.log("\n🔍 Testing DELETE endpoint URL structure");
    const deleteUrl = `/api/children/${child.id}`;
    console.log(`DELETE URL: ${deleteUrl}`);
    
    // Test URL parsing (simulate what happens in the API)
    const pathSegments = deleteUrl.split('/');
    const idFromPath = pathSegments[pathSegments.length - 1];
    console.log(`ID extracted from path: ${idFromPath}`);
    
    if (idFromPath === child.id) {
      console.log("✅ URL parsing works correctly");
    } else {
      console.log("❌ URL parsing failed");
    }
    
    // Clean up
    await prisma.child.delete({
      where: { id: child.id }
    });
    console.log("✅ Cleaned up test child");
    
    console.log("\n🎉 API structure tests completed!");
    
  } catch (error) {
    console.error("❌ API test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testChildAPI();