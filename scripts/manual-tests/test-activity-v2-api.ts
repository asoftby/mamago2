/**
 * Test script for Activity V2 API
 * Tests CRUD operations and classification
 */

import prisma from "../../src/lib/prisma";
import {
  getActivitySections,
  getActivitySectionLabels,
  isPlaceRequired,
} from "../../src/lib/activity/classification";

async function main() {
  console.log("🧪 Testing Activity V2 API\n");

  // Find or create test user
  let businessOwner = await prisma.user.findFirst({
    where: { role: "BUSINESS_OWNER" },
  });

  if (!businessOwner) {
    console.log("Creating test business owner...");
    businessOwner = await prisma.user.create({
      data: {
        email: "test-activity-owner@example.com",
        passwordHash: "test",
        role: "BUSINESS_OWNER",
      },
    });
  }

  console.log(`✅ Business Owner: ${businessOwner.email}\n`);

  // Create test place
  console.log("Creating test place...");
  const place = await prisma.place.create({
    data: {
      ownerUserId: businessOwner.id,
      title: "Test Activity Center",
      category: "activity-center",
      shortDesc: "A place for activities",
      status: "PUBLISHED",
      logoImageId: "test-logo",
      lat: 53.9,
      lng: 27.5,
      locationSource: "GOOGLE",
    },
  });
  console.log(`✅ Created Place: ${place.id}\n`);

  // Test 1: Classification - EVENT
  console.log("Test 1: Classification - EVENT (ONE_TIME)");
  let sections = getActivitySections("EVENT", "ONE_TIME");
  let labels = getActivitySectionLabels("EVENT", "ONE_TIME");
  console.log(`✅ Sections: ${sections.join(", ")}`);
  console.log(`✅ Labels: ${labels.join(", ")}`);
  console.assert(
    sections.length === 1 && sections[0] === "where-to-go",
    "EVENT should be in where-to-go"
  );
  console.log();

  // Test 2: Classification - COURSE
  console.log("Test 2: Classification - COURSE (RECURRING)");
  sections = getActivitySections("COURSE", "RECURRING");
  labels = getActivitySectionLabels("COURSE", "RECURRING");
  console.log(`✅ Sections: ${sections.join(", ")}`);
  console.log(`✅ Labels: ${labels.join(", ")}`);
  console.assert(
    sections.length === 1 && sections[0] === "classes",
    "COURSE should be in classes"
  );
  console.log();

  // Test 3: Classification - PERMANENT (ALWAYS)
  console.log("Test 3: Classification - PERMANENT (ALWAYS)");
  sections = getActivitySections("PERMANENT", "ALWAYS");
  labels = getActivitySectionLabels("PERMANENT", "ALWAYS");
  console.log(`✅ Sections: ${sections.join(", ")}`);
  console.log(`✅ Labels: ${labels.join(", ")}`);
  console.assert(
    sections.length === 2 &&
      sections.includes("where-to-go") &&
      sections.includes("always-nearby"),
    "PERMANENT ALWAYS should be in where-to-go + always-nearby"
  );
  console.log();

  // Test 4: Classification - ROUTE
  console.log("Test 4: Classification - ROUTE (no place required)");
  sections = getActivitySections("ROUTE", "ONE_TIME");
  console.log(`✅ Sections: ${sections.join(", ")}`);
  console.assert(
    !isPlaceRequired("ROUTE"),
    "ROUTE should not require place"
  );
  console.assert(
    isPlaceRequired("EVENT"),
    "EVENT should require place"
  );
  console.log();

  // Test 5: Create EVENT activity
  console.log("Test 5: Create EVENT activity");
  const eventActivity = await prisma.activity.create({
    data: {
      ownerUserId: businessOwner.id,
      placeId: place.id,
      type: "EVENT",
      status: "DRAFT",
      title: "Test Event",
      shortDesc: "A test event",
      scheduleMode: "ONE_TIME",
      ageTags: ["3-7", "7-12"],
      scheduleJson: {
        date: "2026-03-15",
        time: "10:00",
      },
      nextOccurrenceAt: new Date("2026-03-15T10:00:00Z"),
    },
  });
  console.log(`✅ Created EVENT: ${eventActivity.id}`);
  console.log(`   Type: ${eventActivity.type}`);
  console.log(`   Schedule: ${eventActivity.scheduleMode}`);
  console.log(`   Sections: ${getActivitySectionLabels(eventActivity.type, eventActivity.scheduleMode).join(", ")}`);
  console.log();

  // Test 6: Create COURSE activity
  console.log("Test 6: Create COURSE activity");
  const courseActivity = await prisma.activity.create({
    data: {
      ownerUserId: businessOwner.id,
      placeId: place.id,
      type: "COURSE",
      status: "DRAFT",
      title: "Test Course",
      shortDesc: "A test course",
      scheduleMode: "RECURRING",
      ageTags: ["7-12"],
      scheduleJson: {
        weekdays: ["monday", "wednesday"],
        time: "15:00",
      },
    },
  });
  console.log(`✅ Created COURSE: ${courseActivity.id}`);
  console.log(`   Type: ${courseActivity.type}`);
  console.log(`   Schedule: ${courseActivity.scheduleMode}`);
  console.log(`   Sections: ${getActivitySectionLabels(courseActivity.type, courseActivity.scheduleMode).join(", ")}`);
  console.log();

  // Test 7: Create PERMANENT activity
  console.log("Test 7: Create PERMANENT activity");
  const permanentActivity = await prisma.activity.create({
    data: {
      ownerUserId: businessOwner.id,
      placeId: place.id,
      type: "PERMANENT",
      status: "DRAFT",
      title: "Test Permanent Activity",
      shortDesc: "Always available",
      scheduleMode: "ALWAYS",
      ageTags: ["0-3", "3-7"],
    },
  });
  console.log(`✅ Created PERMANENT: ${permanentActivity.id}`);
  console.log(`   Type: ${permanentActivity.type}`);
  console.log(`   Schedule: ${permanentActivity.scheduleMode}`);
  console.log(`   Sections: ${getActivitySectionLabels(permanentActivity.type, permanentActivity.scheduleMode).join(", ")}`);
  console.log();

  // Test 8: Create ROUTE activity (no place)
  console.log("Test 8: Create ROUTE activity (no place)");
  const routeActivity = await prisma.activity.create({
    data: {
      ownerUserId: businessOwner.id,
      placeId: null,
      type: "ROUTE",
      status: "DRAFT",
      title: "Test Route",
      shortDesc: "A walking route",
      scheduleMode: "ON_DEMAND",
      ageTags: ["3-7", "7-12"],
    },
  });
  console.log(`✅ Created ROUTE: ${routeActivity.id}`);
  console.log(`   Type: ${routeActivity.type}`);
  console.log(`   Schedule: ${routeActivity.scheduleMode}`);
  console.log(`   Place: ${routeActivity.placeId || "none (OK for ROUTE)"}`);
  console.log(`   Sections: ${getActivitySectionLabels(routeActivity.type, routeActivity.scheduleMode).join(", ")}`);
  console.log();

  // Test 9: Create OFFER activity (for future birthday constructor)
  console.log("Test 9: Create OFFER activity");
  const offerActivity = await prisma.activity.create({
    data: {
      ownerUserId: businessOwner.id,
      placeId: place.id,
      type: "OFFER",
      status: "DRAFT",
      title: "Birthday Party Package",
      shortDesc: "Special birthday offer",
      scheduleMode: "ON_DEMAND",
      ageTags: ["3-7", "7-12"],
      priceFrom: 100,
      priceTo: 300,
      priceText: "от 100 BYN",
    },
  });
  console.log(`✅ Created OFFER: ${offerActivity.id}`);
  console.log(`   Type: ${offerActivity.type}`);
  console.log(`   Schedule: ${offerActivity.scheduleMode}`);
  console.log(`   Sections: ${getActivitySectionLabels(offerActivity.type, offerActivity.scheduleMode).join(", ")}`);
  console.log();

  // Test 10: List activities by owner
  console.log("Test 10: List activities by owner");
  const activities = await prisma.activity.findMany({
    where: { ownerUserId: businessOwner.id },
    select: {
      id: true,
      title: true,
      type: true,
      scheduleMode: true,
      status: true,
    },
  });
  console.log(`✅ Found ${activities.length} activities`);
  activities.forEach((a) => {
    const sections = getActivitySectionLabels(a.type, a.scheduleMode);
    console.log(`   - ${a.title} (${a.type}, ${a.scheduleMode}) → ${sections.join(", ")}`);
  });
  console.log();

  // Cleanup
  console.log("Cleaning up test data...");
  await prisma.activity.deleteMany({
    where: {
      id: {
        in: [
          eventActivity.id,
          courseActivity.id,
          permanentActivity.id,
          routeActivity.id,
          offerActivity.id,
        ],
      },
    },
  });
  await prisma.place.delete({
    where: { id: place.id },
  });
  console.log("✅ Cleanup complete\n");

  console.log("🎉 All tests passed!");
}

main()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
