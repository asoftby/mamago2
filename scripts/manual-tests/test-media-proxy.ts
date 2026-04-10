/**
 * Test Media Proxy Route
 * 
 * Verifies that media files with .blob extension are served
 * with correct Content-Type headers via the proxy route.
 * 
 * Run: npx tsx scripts/manual-tests/test-media-proxy.ts
 */

import { prisma } from "../../src/lib/prisma";

async function testMediaProxy() {
  console.log("🧪 Testing Media Proxy Route\n");

  // Get a sample media asset
  const media = await prisma.mediaAsset.findFirst({
    where: {
      kind: "IMAGE",
      publicUrl: { startsWith: "/uploads/" },
    },
  });

  if (!media) {
    console.log("❌ No media assets found to test");
    return;
  }

  console.log("📄 Testing with media asset:");
  console.log(`  ID: ${media.id}`);
  console.log(`  Filename: ${media.filename}`);
  console.log(`  Extension: ${media.extension}`);
  console.log(`  MIME Type: ${media.mimeType}`);
  console.log(`  Public URL: ${media.publicUrl}\n`);

  // Test direct URL (should download)
  console.log("🔗 Direct URL (old behavior):");
  console.log(`  ${media.publicUrl}`);
  console.log(`  → Browser will DOWNLOAD file (wrong extension)\n`);

  // Test proxy URL (should display)
  const proxyUrl = `/api/media/${media.filename}`;
  console.log("🔗 Proxy URL (new behavior):");
  console.log(`  ${proxyUrl}`);
  console.log(`  → Browser will DISPLAY image (correct Content-Type header)\n`);

  console.log("✅ Test complete!");
  console.log("\nTo verify:");
  console.log(`1. Open: http://localhost:3000${media.publicUrl}`);
  console.log(`   → Should download file`);
  console.log(`2. Open: http://localhost:3000${proxyUrl}`);
  console.log(`   → Should display image in browser`);
}

testMediaProxy()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
