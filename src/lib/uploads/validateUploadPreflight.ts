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
import {
  MAX_UPLOAD_SIZE_BYTES,
  getFileTooLargeMessage,
  resolveUploadMimeType,
} from "./uploadConfig";
import { jsonUploadError } from "./uploadErrors";

/**
 * Validate file before any memory read or processing.
 *
 * @param file - The File object from formData
 * @returns NextResponse with error details if validation fails, or null if valid
 */
export function validateUploadPreflight(file: File): NextResponse | null {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return jsonUploadError(
      "FILE_TOO_LARGE",
      getFileTooLargeMessage(),
      413,
    );
  }

  const resolvedMimeType = resolveUploadMimeType(file);
  if (!resolvedMimeType) {
    const reportedType = file.type || "unknown";
    return jsonUploadError(
      "INVALID_FILE_TYPE",
      `Unsupported file type: ${reportedType}. Allowed: JPEG, JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF`,
      415,
    );
  }

  return null;
}
