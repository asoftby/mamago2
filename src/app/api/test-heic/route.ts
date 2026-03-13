/**
 * Test HEIC Support Endpoint
 * GET /api/test-heic
 */

import { NextResponse } from "next/server";
import sharp from "sharp";

// Force Node.js runtime for sharp support
export const runtime = 'nodejs';

export async function GET() {
  try {
    const formats = sharp.format;
    const heifSupported = formats.heif?.input?.file || false;
    
    return NextResponse.json({
      sharpVersion: sharp.versions.sharp,
      libheifVersion: sharp.versions.heif || "NOT INSTALLED",
      heifSupported,
      supportedFormats: Object.keys(formats).filter(f => formats[f as keyof typeof formats]?.input?.file),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}
