#!/usr/bin/env tsx

/**
 * Test script to check Prisma include functionality
 */

import { prisma } from "../../src/lib/prisma";

async function testPrismaInclude() {
  console.log("🔍 Testing Prisma Include Functionality");
  
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
    
    console.log(`✅ Found test user: ${testUser.email}`);
    
    // Create a test child with interests
    const child = await prisma.child.create({
      data: {
        name: "Include Test Child",
        birthDate: new Date("2020-01-01"),
        parentId: testUser.id
      }
    });
    
    // Add interests
    await prisma.childInterest.create({
      data: {
        childId: child.id,
        interestSlug: "art"
      }
    });
    
    await prisma.childCustomInterest.create({
      data: {
        childId: child.id,
        label: "тестовый интерес"
      }
    });
    
    console.log(`✅ Created test child with interests: ${child.name}`);
    
    // Test 1: Basic child query
    console.log("\n📝 Test 1: Basic child query");
    const children = await prisma.child.findMany({
      where: { parentId: testUser.id }
    });
    console.log(`✅ Found ${children.length} children`);
    
    // Test 2: Try include with systemInterests
    console.log("\n🎯 Test 2: Include systemInterests");
    try {
      const childWithSystemInterests = await prisma.child.findFirst({
        where: { parentId: testUser.id },
        include: {
          systemInterests: true
        }
      });
      console.log("✅ systemInterests include works");
      console.log("systemInterests:", childWithSystemInterests?.systemInterests);
    } catch (error) {
      console.log("❌ systemInterests include failed:", error);
    }
    
    // Test 3: Try include with customInterests
    console.log("\n🎨 Test 3: Include customInterests");
    try {
      const childWithCustomInterests = await prisma.child.findFirst({
        where: { parentId: testUser.id },
        include: {
          customInterests: true
        }
      });
      console.log("✅ customInterests include works");
      console.log("customInterests:", childWithCustomInterests?.customInterests);
    } catch (error) {
      console.log("❌ customInterests include failed:", error);
    }
    
    // Test 4: Try include with both
    console.log("\n🔄 Test 4: Include both interests");
    try {
      const childWithBothInterests = await prisma.child.findFirst({
        where: { parentId: testUser.id },
        include: {
          systemInterests: true,
          customInterests: true
        }
      });
      console.log("✅ Both interests include works");
      console.log("systemInterests:", childWithBothInterests?.systemInterests);
      console.log("customInterests:", childWithBothInterests?.customInterests);
    } catch (error) {
      console.log("❌ Both interests include failed:", error);
    }
    
    // Clean up
    await prisma.child.delete({
      where: { id: child.id }
    });
    console.log("\n🧹 Cleaned up test data");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaInclude();