/**
 * Test HEIC/HEIF Support
 * 
 * Checks if sharp can process HEIC/HEIF files
 */

import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

async function testHEICSupport() {
  console.log("🧪 Testing HEIC/HEIF Support\n");
  console.log("=".repeat(60));

  // Check sharp version and formats
  console.log("\n📦 Sharp Information:");
  console.log("Sharp version:", sharp.versions.sharp);
  console.log("libheif version:", sharp.versions.heif || "NOT INSTALLED");
  
  // Check supported formats
  console.log("\n📋 Supported Input Formats:");
  const formats = sharp.format;
  for (const [format, info] of Object.entries(formats)) {
    if (info.input) {
      console.log(`  ✅ ${format.toUpperCase()}`);
    }
  }

  // Check HEIC/HEIF specifically
  console.log("\n🔍 HEIC/HEIF Status:");
  const heifSupported = formats.heif?.input?.file || false;
  const heicSupported = formats.heic?.input?.file || false;
  
  console.log(`  HEIF input support: ${heifSupported ? "✅ YES" : "❌ NO"}`);
  console.log(`  HEIC input support: ${heicSupported ? "✅ YES" : "❌ NO"}`);

  if (!heifSupported && !heicSupported) {
    console.log("\n⚠️  HEIC/HEIF is NOT supported");
    console.log("   libheif is not installed or not properly configured");
    console.log("\n💡 To add support:");
    console.log("   1. Install libheif system library");
    console.log("   2. Reinstall sharp: pnpm install sharp");
    console.log("   3. Sharp will automatically detect libheif");
    return;
  }

  console.log("\n✅ HEIC/HEIF is supported!");

  // Test with a minimal HEIC buffer (will fail but shows error handling)
  console.log("\n🧪 Testing HEIC processing...");
  
  try {
    // Create a minimal test buffer (not a real HEIC, just for testing)
    const testBuffer = Buffer.from("ftyp");
    
    const instance = sharp(testBuffer);
    const metadata = await instance.metadata();
    
    console.log("✅ Metadata read:", metadata);
  } catch (error: unknown) {
    console.log("❌ Test failed (expected for fake buffer):", error instanceof Error ? error.message : String(error));
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Summary:");
  console.log(`  Sharp version: ${sharp.versions.sharp}`);
  console.log(`  libheif version: ${sharp.versions.heif || "NOT INSTALLED"}`);
  console.log(`  HEIC/HEIF support: ${heifSupported || heicSupported ? "✅ YES" : "❌ NO"}`);
  
  if (heifSupported || heicSupported) {
    console.log("\n🎉 HEIC/HEIF uploads should work!");
  } else {
    console.log("\n⚠️  HEIC/HEIF uploads will fail with clear error message");
  }
}

// Run test
testHEICSupport().catch(console.error);
