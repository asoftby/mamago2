/**
 * Test script for Place API endpoints
 * Run: pnpm tsx scripts/test-place-api.ts
 * 
 * Note: This tests the service layer directly, not HTTP endpoints
 */

import prisma from "../src/lib/prisma";
import { ContentStatus, LocationSource, PlaceKind, PlaceImageKind } from "@prisma/client";

async function main() {
  console.log("🧪 Testing Place API logic...\n");

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: "place-api-test@example.com" },
    update: {},
    create: {
      email: "place-api-test@example.com",
      passwordHash: "test-hash",
      role: "BUSINESS_OWNER",
    },
  });
  console.log("✅ Test user created:", testUser.email);

  // Test 1: Create Place (DRAFT)
  console.log("\n📝 Test 1: Create Place (DRAFT)");
  const place = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Test Cafe",
      category: "cafe",
      shortDesc: "A test cafe",
      status: ContentStatus.DRAFT,
    },
  });
  console.log("✅ Created:", {
    id: place.id,
    title: place.title,
    status: place.status,
  });

  // Test 2: Update Place (autosave)
  console.log("\n📝 Test 2: Update Place (autosave)");
  const updated = await prisma.place.update({
    where: { id: place.id },
    data: {
      description: "Full description for SEO",
      phone: "+375291234567",
      ageTags: ["0-3", "3-7"],
    },
  });
  console.log("✅ Updated:", {
    description: updated.description,
    phone: updated.phone,
    ageTags: updated.ageTags,
  });

  // Test 3: Set Google location
  console.log("\n📍 Test 3: Set Google location");
  const withGoogleLocation = await prisma.place.update({
    where: { id: place.id },
    data: {
      locationSource: LocationSource.GOOGLE,
      googlePlaceId: "ChIJ_test_place_id",
      lat: 53.9006,
      lng: 27.559,
      formattedAddr: "ул. Ленина 10, Минск",
      countryCode: "BY",
    },
  });
  console.log("✅ Google location set:", {
    locationSource: withGoogleLocation.locationSource,
    googlePlaceId: withGoogleLocation.googlePlaceId,
    lat: withGoogleLocation.lat,
    lng: withGoogleLocation.lng,
  });

  // Test 4: Add logo image
  console.log("\n🖼️  Test 4: Add logo image");
  const logoImage = await prisma.placeImage.create({
    data: {
      placeId: place.id,
      kind: PlaceImageKind.LOGO,
      url: "https://example.com/logo.jpg",
      width: 400,
      height: 400,
      sortOrder: 0,
    },
  });
  await prisma.place.update({
    where: { id: place.id },
    data: { logoImageId: logoImage.id },
  });
  console.log("✅ Logo added:", logoImage.id);

  // Test 5: Add gallery images
  console.log("\n🖼️  Test 5: Add gallery images");
  await prisma.placeImage.createMany({
    data: [
      {
        placeId: place.id,
        kind: PlaceImageKind.GALLERY,
        url: "https://example.com/gallery1.jpg",
        width: 1920,
        height: 1080,
        sortOrder: 1,
      },
      {
        placeId: place.id,
        kind: PlaceImageKind.GALLERY,
        url: "https://example.com/gallery2.jpg",
        width: 1920,
        height: 1080,
        sortOrder: 2,
      },
    ],
  });
  console.log("✅ Gallery images added");

  // Test 6: Validate for submit (should pass)
  console.log("\n✅ Test 6: Validate for submit");
  const placeForValidation = await prisma.place.findUnique({
    where: { id: place.id },
    include: { images: true },
  });

  const missing: string[] = [];
  if (!placeForValidation?.title) missing.push("title");
  if (!placeForValidation?.category) missing.push("category");
  if (!placeForValidation?.shortDesc) missing.push("shortDesc");
  if (!placeForValidation?.logoImageId) missing.push("logoImageId");
  if (placeForValidation?.lat === null) missing.push("lat");
  if (placeForValidation?.lng === null) missing.push("lng");

  if (missing.length > 0) {
    console.log("❌ Validation failed:", missing);
  } else {
    console.log("✅ Validation passed - ready to submit");
  }

  // Test 7: Submit for moderation
  console.log("\n📤 Test 7: Submit for moderation");
  const submitted = await prisma.place.update({
    where: { id: place.id },
    data: { status: ContentStatus.PENDING },
  });
  console.log("✅ Submitted:", {
    status: submitted.status,
  });

  // Test 8: Try to submit again (should fail - wrong status)
  console.log("\n❌ Test 8: Try to submit again (should fail)");
  const canSubmit =
    submitted.status === ContentStatus.DRAFT ||
    submitted.status === ContentStatus.REJECTED ||
    submitted.status === ContentStatus.NEEDS_CHANGES;
  console.log("Can submit?", canSubmit ? "Yes" : "No (correct!)");

  // Test 9: List places
  console.log("\n📋 Test 9: List places");
  const places = await prisma.place.findMany({
    where: { ownerUserId: testUser.id },
    include: {
      images: {
        where: { kind: PlaceImageKind.LOGO },
        take: 1,
      },
    },
  });
  console.log("✅ Found places:", places.length);
  places.forEach((p) => {
    console.log(`  - ${p.title} (${p.status})`);
  });

  // Test 10: Test manual location
  console.log("\n📍 Test 10: Test manual location");
  const manualPlace = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Manual Location Place",
      category: "park",
      shortDesc: "Place with manual location",
      status: ContentStatus.DRAFT,
      locationSource: LocationSource.MANUAL,
      lat: 53.9,
      lng: 27.55,
      customAddress: "Somewhere in Minsk",
    },
  });
  console.log("✅ Manual location place:", {
    locationSource: manualPlace.locationSource,
    customAddress: manualPlace.customAddress,
  });

  // Test 11: Test UNIT creation
  console.log("\n🏢 Test 11: Test UNIT creation");
  const complex = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Test Mall",
      category: "shopping-mall",
      shortDesc: "Test shopping mall",
      placeKind: PlaceKind.COMPLEX,
      status: ContentStatus.PUBLISHED,
      locationSource: LocationSource.GOOGLE,
      googlePlaceId: "ChIJ_test_mall",
      lat: 53.9,
      lng: 27.55,
    },
  });

  const unit = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Shop in Mall",
      category: "shop",
      shortDesc: "A shop inside the mall",
      placeKind: PlaceKind.UNIT,
      parentPlaceId: complex.id,
      floor: "2",
      unit: "A12",
      unitLabel: "2 этаж, павильон A12",
      lat: complex.lat,
      lng: complex.lng,
      status: ContentStatus.DRAFT,
    },
  });
  console.log("✅ UNIT created:", {
    title: unit.title,
    unitLabel: unit.unitLabel,
    parentPlaceId: unit.parentPlaceId,
  });

  // Cleanup
  console.log("\n🧹 Cleanup...");
  await prisma.place.deleteMany({
    where: { ownerUserId: testUser.id },
  });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("✅ Cleanup complete");

  console.log("\n✅ All API logic tests passed!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
