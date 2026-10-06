/**
 * Regression guard for business event media uploads.
 *
 * The event wizard must never decode/process phone photos in the browser
 * itself: renderer OOM kills the whole tab before an ordinary error can be
 * handled. HEIC/HEIF is no longer rejected here: the shared upload transport
 * (`uploadMediaFile`) is the only place that converts it to JPEG (see
 * src/lib/uploads/heicConversion.ts and uploadPipeline.contract.test.ts).
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
  !source.includes("isHeicFile(file)") && !source.includes("EVENT_HEIC_UNSUPPORTED_MESSAGE"),
  "Event media must not reject HEIC/HEIF itself: the shared upload transport converts it before the request",
);

assert.ok(
  !source.includes("convertHeicFileToJpegIfNeeded") && !source.includes("heicConversion"),
  "Event media must not run or import HEIC conversion itself; only the shared upload transport owns it",
);

assert.ok(
  !source.includes("URL.createObjectURL(file)"),
  "Event media must not create local blob previews for full-size upload files",
);

assert.ok(
  source.includes("MAX_IMAGE_FILES - galleryItems.length"),
  "Gallery uploads must cap the number of selected images before upload work starts",
);

assert.ok(
  source.includes("prev.filter((img) => img.id !== placeholderId)"),
  "Failed uploads must remove their placeholder so retries do not consume gallery capacity",
);

console.log("Step3Media.uploadSafety.test.ts: OK");
