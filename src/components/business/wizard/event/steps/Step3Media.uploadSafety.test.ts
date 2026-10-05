/**
 * Regression guard for business event media uploads.
 *
 * The event wizard must never decode/process phone photos in the browser:
 * renderer OOM kills the whole tab before an ordinary error can be handled.
 *
 * Run: pnpm exec tsx src/components/business/wizard/event/steps/Step3Media.uploadSafety.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/business/wizard/event/steps/Step3Media.tsx"),
  "utf8",
);

assert.ok(
  source.includes("await uploadMediaFile(file)"),
  "Event media must upload the original supported file directly to the server",
);

assert.ok(
  source.includes("isHeicFile(file)"),
  "Event media must detect HEIC/HEIF before starting an upload",
);

assert.ok(
  source.includes("EVENT_HEIC_UNSUPPORTED_MESSAGE"),
  "HEIC/HEIF must fail with a recoverable user-facing message",
);

assert.ok(
  !source.includes("convertHeicFileToJpegIfNeeded"),
  "Event media must not run HEIC conversion in the browser",
);

assert.ok(
  !source.includes("URL.createObjectURL(file)"),
  "Event media must not create local blob previews for full-size upload files",
);

assert.ok(
  source.includes("MAX_IMAGE_FILES - galleryItems.length"),
  "Gallery uploads must cap the number of selected images before upload work starts",
);

console.log("Step3Media.uploadSafety.test.ts: OK");
