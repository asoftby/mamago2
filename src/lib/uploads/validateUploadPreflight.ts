/**
 * Upload Preflight Validation
 *
 * Fast, early validation of upload files BEFORE reading into memory.
 * Acts as the first protective layer against DoS attacks via oversized
 * or disallowed file types.
 *
 * Deep validation inside imageProcessor (validateImageFile) remains in place.
 */

import { NextResponse } from "next/server";

/** Maximum allowed file size: 15 MB */
export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

/** Allowed MIME types for upload */
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/**
 * Validate file before any memory read or processing.
 *
 * @param file - The File object from formData
 * @returns NextResponse with error details if validation fails, or null if valid
 */
export function validateUploadPreflight(file: File): NextResponse | null {
  // 1. Check file size
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File too large" },
      { status: 413 },
    );
  }

  // 2. Check MIME type
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type" },
      { status: 415 },
    );
  }

  return null;
}