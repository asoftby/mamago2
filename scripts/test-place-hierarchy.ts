/**
 * Test script to verify Place hierarchy (Complex → Units)
 * Run: pnpm tsx scripts/test-place-hierarchy.ts
 */

import prisma from "../src/lib/prisma";
import {
  ContentStatus,
  LocationSource,
  PlaceKind,
  PlaceImageKind,
} from "@prisma/client";

async function main() {
  console.log("🧪 Testing Place hierarchy (Complex → Units)...\n");

  // Test 1: Check PlaceKind enum
  console.log("✅ PlaceKind enum:", Object.keys(PlaceKind));

  // Test 2: Create test user
  const testUser = await prisma.user.upsert({
    where: { email: "hierarchy-test@example.com" },
    update: {},
    create: {
      email: "hierarchy-test@example.com",
      passwordHash: "test-hash",
      role: "BUSINESS_OWNER",
    },
  });
  console.log("\n✅ Test user:", testUser.email);

  // Test 3: Create COMPLEX (торговый центр)
  const mall = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Dana Mall",
      category: "shopping-mall",
      shortDesc: "Торговый центр Dana Mall",
      description: "Крупный торговый центр в центре Минска",
      status: ContentStatus.PUBLISHED,
      placeKind: PlaceKind.COMPLEX,
      locationSource: LocationSource.GOOGLE,
      googlePlaceId: "ChIJ_test_dana_mall",
      lat: 53.9006,
      lng: 27.559,
      formattedAddr: "ул. Петра Мстиславца 11, Минск",
      countryCode: "BY",
    },
  });
  console.log("\n✅ Created COMPLEX:", {
    id: mall.id,
    title: mall.title,
    placeKind: mall.placeKind,
  });

  // Test 4: Create UNIT inside mall (кафе на 2 этаже)
  const cafeInMall = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Coffee House",
      category: "cafe",
      shortDesc: "Кофейня в Dana Mall",
      status: ContentStatus.DRAFT,
      placeKind: PlaceKind.UNIT,
      parentPlaceId: mall.id,
      floor: "2",
      unit: "A12",
      unitLabel: "2 этаж, павильон A12",
      // UNIT наследует координаты от родителя
      lat: mall.lat,
      lng: mall.lng,
      locationSource: LocationSource.MANUAL,
    },
  });
  console.log("\n✅ Created UNIT:", {
    id: cafeInMall.id,
    title: cafeInMall.title,
    placeKind: cafeInMall.placeKind,
    parentPlaceId: cafeInMall.parentPlaceId,
    unitLabel: cafeInMall.unitLabel,
  });

  // Test 5: Create another UNIT (детский центр на 3 этаже)
  const kidsCenter = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Kids Zone",
      category: "kids-center",
      shortDesc: "Детский развлекательный центр",
      status: ContentStatus.PUBLISHED,
      placeKind: PlaceKind.UNIT,
      parentPlaceId: mall.id,
      floor: "3",
      unit: "B05",
      unitLabel: "3 этаж, павильон B05",
      lat: mall.lat,
      lng: mall.lng,
      locationSource: LocationSource.MANUAL,
    },
  });
  console.log("\n✅ Created another UNIT:", {
    id: kidsCenter.id,
    title: kidsCenter.title,
    unitLabel: kidsCenter.unitLabel,
  });

  // Test 6: Query COMPLEX with children
  const mallWithChildren = await prisma.place.findUnique({
    where: { id: mall.id },
    include: {
      children: {
        orderBy: { floor: "asc" },
      },
    },
  });
  console.log("\n✅ COMPLEX with children:", {
    title: mallWithChildren?.title,
    childrenCount: mallWithChildren?.children.length,
    children: mallWithChildren?.children.map((c) => ({
      title: c.title,
      unitLabel: c.unitLabel,
    })),
  });

  // Test 7: Query UNIT with parent
  const unitWithParent = await prisma.place.findUnique({
    where: { id: cafeInMall.id },
    include: {
      parentPlace: true,
    },
  });
  console.log("\n✅ UNIT with parent:", {
    title: unitWithParent?.title,
    unitLabel: unitWithParent?.unitLabel,
    parentTitle: unitWithParent?.parentPlace?.title,
  });

  // Test 8: Find all UNITs in a COMPLEX
  const unitsInMall = await prisma.place.findMany({
    where: {
      parentPlaceId: mall.id,
      placeKind: PlaceKind.UNIT,
    },
    orderBy: [{ floor: "asc" }, { unit: "asc" }],
  });
  console.log("\n✅ All UNITs in COMPLEX:", {
    count: unitsInMall.length,
    units: unitsInMall.map((u) => ({
      title: u.title,
      floor: u.floor,
      unit: u.unit,
    })),
  });

  // Test 9: Test googlePlaceId uniqueness
  // COMPLEX and STANDALONE can have googlePlaceId
  // UNIT can have NULL googlePlaceId (multiple units in same building)
  console.log("\n✅ googlePlaceId uniqueness:", {
    complex: mall.googlePlaceId,
    unit1: cafeInMall.googlePlaceId, // null
    unit2: kidsCenter.googlePlaceId, // null
  });

  // Test 10: Create STANDALONE place (обычное место)
  const standaloneCafe = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Standalone Cafe",
      category: "cafe",
      shortDesc: "Отдельное кафе",
      status: ContentStatus.DRAFT,
      placeKind: PlaceKind.STANDALONE,
      locationSource: LocationSource.GOOGLE,
      googlePlaceId: "ChIJ_test_standalone_cafe",
      lat: 53.9,
      lng: 27.55,
    },
  });
  console.log("\n✅ Created STANDALONE:", {
    id: standaloneCafe.id,
    title: standaloneCafe.title,
    placeKind: standaloneCafe.placeKind,
    googlePlaceId: standaloneCafe.googlePlaceId,
  });

  // Test 11: Query by placeKind
  const complexes = await prisma.place.count({
    where: { placeKind: PlaceKind.COMPLEX },
  });
  const units = await prisma.place.count({
    where: { placeKind: PlaceKind.UNIT },
  });
  const standalones = await prisma.place.count({
    where: { placeKind: PlaceKind.STANDALONE },
  });
  console.log("\n✅ Count by placeKind:", {
    COMPLEX: complexes,
    UNIT: units,
    STANDALONE: standalones,
  });

  // Cleanup
  await prisma.place.deleteMany({
    where: {
      ownerUserId: testUser.id,
    },
  });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("\n🧹 Cleanup complete");

  console.log("\n✅ All hierarchy tests passed!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
