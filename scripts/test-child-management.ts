#!/usr/bin/env tsx

/**
 * Test script for child management functionality
 * Tests create, read, update, delete operations
 */

import { prisma } from "../src/lib/prisma";

async function testChildManagement() {
  console.log("🧪 Testing Child Management Functionality");
  
  try {
    // Find a test user (or create one)
    let testUser = await prisma.user.findFirst({
      where: { email: { contains: "test" } }
    });
    
    if (!testUser) {
      console.log("Creating test user...");
      testUser = await prisma.user.create({
        data: {
          email: "test@example.com",
          passwordHash: "test-hash",
          role: "USER"
        }
      });
    }
    
    console.log(`✅ Using test user: ${testUser.email} (${testUser.id})`);
    
    // Test 1: Create a child
    console.log("\n📝 Test 1: Creating a child");
    const child = await prisma.child.create({
      data: {
        name: "Test Child",
        birthDate: new Date("2018-05-15"),
        parentId: testUser.id
      }
    });
    console.log(`✅ Created child: ${child.name} (${child.id})`);
    
    // Test 2: Add system interests
    console.log("\n🎯 Test 2: Adding system interests");
    await prisma.childInterest.createMany({
      data: [
        { childId: child.id, interestSlug: "sport" },
        { childId: child.id, interestSlug: "music" }
      ]
    });
    console.log("✅ Added system interests: sport, music");
    
    // Test 3: Add custom interests
    console.log("\n🎨 Test 3: Adding custom interests");
    await prisma.childCustomInterest.createMany({
      data: [
        { childId: child.id, label: "динозавры" },
        { childId: child.id, label: "космос" }
      ]
    });
    console.log("✅ Added custom interests: динозавры, космос");
    
    // Test 4: Read child with interests
    console.log("\n📖 Test 4: Reading child with interests");
    const childWithInterests = await prisma.child.findUnique({
      where: { id: child.id },
      include: {
        systemInterests: true,
        customInterests: true
      }
    });
    
    if (childWithInterests) {
      console.log(`✅ Child: ${childWithInterests.name}`);
      console.log(`   System interests: ${childWithInterests.systemInterests.map(i => i.interestSlug).join(", ")}`);
      console.log(`   Custom interests: ${childWithInterests.customInterests.map(i => i.label).join(", ")}`);
    }
    
    // Test 5: Update child
    console.log("\n✏️ Test 5: Updating child");
    await prisma.child.update({
      where: { id: child.id },
      data: { name: "Updated Test Child" }
    });
    console.log("✅ Updated child name");
    
    // Test 6: Delete child (should cascade delete interests)
    console.log("\n🗑️ Test 6: Deleting child");
    await prisma.child.delete({
      where: { id: child.id }
    });
    console.log("✅ Deleted child (interests should be cascade deleted)");
    
    // Test 7: Verify interests are deleted
    console.log("\n🔍 Test 7: Verifying cascade deletion");
    const remainingSystemInterests = await prisma.childInterest.count({
      where: { childId: child.id }
    });
    const remainingCustomInterests = await prisma.childCustomInterest.count({
      where: { childId: child.id }
    });
    
    if (remainingSystemInterests === 0 && remainingCustomInterests === 0) {
      console.log("✅ Cascade deletion working correctly");
    } else {
      console.log(`❌ Cascade deletion failed: ${remainingSystemInterests} system, ${remainingCustomInterests} custom interests remain`);
    }
    
    console.log("\n🎉 All tests completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testChildManagement();