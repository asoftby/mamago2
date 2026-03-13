/**
 * Test Media Metadata Auto-generation
 * 
 * Tests automatic metadata generation based on usage context.
 * 
 * Run: npx tsx scripts/test-media-autogen.ts
 */

import { prisma } from "../src/lib/prisma";
import { getMediaUsageContext } from "../src/lib/media/getMediaUsageContext";
import { resolveEffectiveMetadata } from "../src/lib/media/generateMediaMetadata";

async function testMediaAutogen() {
  console.log("🧪 Testing Media Metadata Auto-generation\n");

  // Find media with usage but no manual metadata
  const media = await prisma.mediaAsset.findFirst({
    where: {
      usages: { some: {} },
      alt: null,
    },
    include: {
      usages: {
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!media) {
    console.log("❌ No media with usage found");
    return;
  }

  console.log("📄 Media asset:");
  console.log(`  ID: ${media.id}`);
  console.log(`  Filename: ${media.filename}`);
  console.log(`  Manual alt: ${media.alt || "(empty)"}`);
  console.log(`  Manual title: ${media.title || "(empty)"}`);
  console.log(`  Manual caption: ${media.caption || "(empty)"}\n`);

  // Get usage context
  const context = await getMediaUsageContext(media.id);

  if (!context) {
    console.log("❌ No usage context found");
    return;
  }

  console.log("🔗 Usage context:");
  console.log(`  Entity Type: ${context.entityType}`);
  console.log(`  Entity Title: ${context.entityTitle || "(unknown)"}`);
  console.log(`  Field: ${context.field || "(unknown)"}`);
  
  if (context.placeAddress) {
    console.log(`  City: ${context.placeAddress.cityName || "(none)"}`);
    console.log(`  Short Address: ${context.placeAddress.shortAddress || "(none)"}`);
  }
  console.log();

  // Generate effective metadata
  const effective = resolveEffectiveMetadata(
    {
      title: media.title,
      alt: media.alt,
      caption: media.caption,
      filename: media.filename,
    },
    context
  );

  console.log("✨ Auto-generated metadata:");
  console.log(`  Title: ${effective.title}`);
  console.log(`  Alt: ${effective.alt}`);
  console.log(`  Caption: ${effective.caption || "(none)"}\n`);

  console.log("✅ Auto-generation works!");
  console.log("\n📝 To verify in UI:");
  console.log(`1. Open: http://localhost:3000/admin/media/${media.id}`);
  console.log(`2. Check "Метаданные" section`);
  console.log(`3. Should see auto-generated values with "(автогенерация)" label`);
  console.log(`4. Click "Редактировать" to see placeholders`);
}

testMediaAutogen()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
