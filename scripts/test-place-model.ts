/**
 * Test script to verify Place and PlaceImage models
 * Run: pnpm tsx scripts/test-place-model.ts
 */

import prisma from "../src/lib/prisma";
import { ContentStatus, LocationSource, PlaceImageKind } from "@prisma/client";

async function main() {
  console.log("🧪 Testing Place and PlaceImage models...\n");

  // Test 1: Check enums are available
  console.log("✅ ContentStatus enum:", Object.keys(ContentStatus));
  console.log("✅ LocationSource enum:", Object.keys(LocationSource));
  console.log("✅ PlaceImageKind enum:", Object.keys(PlaceImageKind));

  // Test 2: Create a test user (if not exists)
  const testUser = await prisma.user.upsert({
    where: { email: "place-test@example.com" },
    update: {},
    create: {
      email: "place-test@example.com",
      passwordHash: "test-hash",
      role: "BUSINESS_OWNER",
    },
  });
  console.log("\n✅ Test user:", testUser.email);

  // Test 3: Create a Place
  const place = await prisma.place.create({
    data: {
      ownerUserId: testUser.id,
      title: "Test Cafe",
      category: "cafe",
      shortDesc: "A cozy test cafe",
      description: "Full description for SEO",
      status: ContentStatus.DRAFT,
      locationSource: LocationSource.MANUAL,
      customAddress: "Test Street 123",
      phone: "+375291234567",
      website: "https://test-cafe.by",
      instagramHandle: "testcafe",
      ageTags: ["0-3", "3-7"],
      visitFormats: ["indoor"],
      activityTypes: ["food", "entertainment"],
    },
  });
  console.log("\n✅ Created Place:", {
    id: place.id,
    title: place.title,
    status: place.status,
    locationSource: place.locationSource,
  });

  // Test 4: Add logo image
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
  console.log("\n✅ Created logo image:", {
    id: logoImage.id,
    kind: logoImage.kind,
    url: logoImage.url,
  });

  // Test 5: Update Place with logoImageId
  const updatedPlace = await prisma.place.update({
    where: { id: place.id },
    data: { logoImageId: logoImage.id },
  });
  console.log("\n✅ Updated Place with logo:", {
    logoImageId: updatedPlace.logoImageId,
  });

  // Test 6: Add gallery images
  const galleryImage = await prisma.placeImage.create({
    data: {
      placeId: place.id,
      kind: PlaceImageKind.GALLERY,
      url: "https://example.com/gallery1.jpg",
      width: 1920,
      height: 1080,
      blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
      sortOrder: 1,
    },
  });
  console.log("\n✅ Created gallery image:", {
    id: galleryImage.id,
    kind: galleryImage.kind,
  });

  // Test 7: Query Place with images
  const placeWithImages = await prisma.place.findUnique({
    where: { id: place.id },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      owner: {
        select: { email: true, role: true },
      },
    },
  });
  console.log("\n✅ Place with images:", {
    title: placeWithImages?.title,
    imagesCount: placeWithImages?.images.length,
    logoCount: placeWithImages?.images.filter((i) => i.kind === "LOGO").length,
    galleryCount: placeWithImages?.images.filter((i) => i.kind === "GALLERY")
      .length,
    owner: placeWithImages?.owner.email,
  });

  // Test 8: Test array fields
  console.log("\n✅ Array fields:", {
    ageTags: placeWithImages?.ageTags,
    visitFormats: placeWithImages?.visitFormats,
    activityTypes: placeWithImages?.activityTypes,
  });

  // Cleanup
  await prisma.placeImage.deleteMany({ where: { placeId: place.id } });
  await prisma.place.delete({ where: { id: place.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("\n🧹 Cleanup complete");

  console.log("\n✅ All tests passed!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
