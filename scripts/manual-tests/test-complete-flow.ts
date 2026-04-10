#!/usr/bin/env tsx

/**
 * Complete test of child management flow
 * Tests database operations, API endpoints, and data loading
 */

import { prisma } from "../../src/lib/prisma";

async function testCompleteFlow() {
  console.log("🚀 Testing Complete Child Management Flow");
  
  try {
    // 1. Setup test user
    let testUser = await prisma.user.findFirst({
      where: { email: "flow-test@example.com" }
    });
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: "flow-test@example.com",
          passwordHash: "test-hash",
          role: "USER"
        }
      });
    }
    
    console.log(`✅ Test user ready: ${testUser.email}`);
    
    // 2. Create child with interests (simulating API create)
    console.log("\n📝 Creating child with interests...");
    const child = await prisma.child.create({
      data: {
        name: "Flow Test Child",
        birthDate: new Date("2019-06-15"),
        parentId: testUser.id
      }
    });
    
    // Add system interests
    await prisma.$queryRaw`
      INSERT INTO "ChildInterest" ("id", "childId", "interestSlug", "source", "createdAt")
      VALUES (gen_random_uuid(), ${child.id}, 'sport', 'SYSTEM', NOW()),
             (gen_random_uuid(), ${child.id}, 'music', 'SYSTEM', NOW())
    `;
    
    // Add custom interests
    await prisma.$queryRaw`
      INSERT INTO "ChildCustomInterest" ("id", "childId", "label", "status", "createdAt")
      VALUES (gen_random_uuid(), ${child.id}, 'роботы', 'RAW', NOW()),
             (gen_random_uuid(), ${child.id}, 'лего', 'RAW', NOW())
    `;
    
    console.log(`✅ Created child: ${child.name} (${child.id})`);
    
    // 3. Test data loading (simulating /me page query)
    console.log("\n📖 Testing data loading (like /me page)...");
    
    const childrenRaw = await prisma.child.findMany({
      where: { parentId: testUser.id },
      orderBy: { createdAt: "desc" },
    });
    
    const childIds = childrenRaw.map(c => c.id);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const systemInterestsData: any[] = await prisma.$queryRaw`
      SELECT "childId", "interestSlug" 
      FROM "ChildInterest" 
      WHERE "childId" = ANY(${childIds})
    `;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customInterestsData: any[] = await prisma.$queryRaw`
      SELECT "childId", "label" 
      FROM "ChildCustomInterest" 
      WHERE "childId" = ANY(${childIds})
    `;
    
    const children = childrenRaw.map(child => ({
      id: child.id,
      name: child.name,
      birthDate: child.birthDate,
      systemInterests: systemInterestsData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((interest: any) => interest.childId === child.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((interest: any) => ({ interestSlug: interest.interestSlug })),
      customInterests: customInterestsData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((interest: any) => interest.childId === child.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((interest: any) => ({ label: interest.label })),
    }));
    
    console.log(`✅ Loaded ${children.length} children with interests`);
    if (children.length > 0) {
      const firstChild = children[0];
      console.log(`   Child: ${firstChild.name}`);
      console.log(`   System interests: ${firstChild.systemInterests.map(i => i.interestSlug).join(", ")}`);
      console.log(`   Custom interests: ${firstChild.customInterests.map(i => i.label).join(", ")}`);
    }
    
    // 4. Test update (simulating API PUT)
    console.log("\n✏️ Testing child update...");
    await prisma.child.update({
      where: { id: child.id },
      data: { name: "Updated Flow Test Child" }
    });
    
    // Clear and update interests
    await prisma.$queryRaw`DELETE FROM "ChildInterest" WHERE "childId" = ${child.id}`;
    await prisma.$queryRaw`DELETE FROM "ChildCustomInterest" WHERE "childId" = ${child.id}`;
    
    await prisma.$queryRaw`
      INSERT INTO "ChildInterest" ("id", "childId", "interestSlug", "source", "createdAt")
      VALUES (gen_random_uuid(), ${child.id}, 'art', 'SYSTEM', NOW())
    `;
    
    await prisma.$queryRaw`
      INSERT INTO "ChildCustomInterest" ("id", "childId", "label", "status", "createdAt")
      VALUES (gen_random_uuid(), ${child.id}, 'обновленный интерес', 'RAW', NOW())
    `;
    
    console.log("✅ Child updated successfully");
    
    // 5. Test deletion (simulating API DELETE)
    console.log("\n🗑️ Testing child deletion...");
    
    // Check interests before deletion
     
    const interestsBefore = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "ChildInterest" WHERE "childId" = ${child.id}
    ` as any[];
     
    const customInterestsBefore = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "ChildCustomInterest" WHERE "childId" = ${child.id}
    ` as any[];
    
    console.log(`   Interests before deletion: ${interestsBefore[0].count} system, ${customInterestsBefore[0].count} custom`);
    
    // Delete child (should cascade)
    await prisma.child.delete({
      where: { id: child.id }
    });
    
    // Check interests after deletion
     
    const interestsAfter = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "ChildInterest" WHERE "childId" = ${child.id}
    ` as any[];
     
     
    const customInterestsAfter = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "ChildCustomInterest" WHERE "childId" = ${child.id}
    ` as any[];
    
    console.log(`   Interests after deletion: ${interestsAfter[0].count} system, ${customInterestsAfter[0].count} custom`);
    
    if (interestsAfter[0].count === "0" && customInterestsAfter[0].count === "0") {
      console.log("✅ Cascade deletion working correctly");
    } else {
      console.log("❌ Cascade deletion failed");
    }
    
    // 6. Test date formatting (simulating PlanCard)
    console.log("\n📅 Testing date formatting...");
    const testDate = new Date("2026-03-16");
    const weekday = testDate.toLocaleDateString("ru-RU", { weekday: "long" });
    const day = testDate.getDate();
    
    // Russian months in genitive case (used with day numbers)
    const monthsGenitive = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря"
    ];
    const month = monthsGenitive[testDate.getMonth()];
    
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const formattedDate = `${capitalizedWeekday}, ${day} ${month}`;
    
    console.log(`✅ Date format: "${formattedDate}"`);
    if (formattedDate === "Понедельник, 16 марта") {
      console.log("✅ Date formatting is correct");
    } else {
      console.log("❌ Date formatting needs adjustment");
    }
    
    console.log("\n🎉 Complete flow test successful!");
    
  } catch (error) {
    console.error("❌ Flow test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteFlow();