import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walkSourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      result.push(...walkSourceFiles(fullPath));
    } else if (/\.(?:ts|tsx)$/.test(entry)) {
      result.push(fullPath);
    }
  }
  return result;
}

const uploadClientPath = join(process.cwd(), "src/lib/uploads/uploadClient.ts");
const uploadClient = readFileSync(uploadClientPath, "utf8");

const convertIndex = uploadClient.indexOf("await convertHeicFileToJpegIfNeeded(file)");
const appendIndex = uploadClient.indexOf('formData.append("file", fileToUpload)');

assert.ok(convertIndex >= 0, "uploadMediaFile must normalize HEIC/HEIF before transport");
assert.ok(appendIndex > convertIndex, "the normalized file must be appended after HEIC conversion");

const heicConversion = readFileSync(join(process.cwd(), "src/lib/uploads/heicConversion.ts"), "utf8");
assert.ok(
  !/await\s+isHeic\s*\(/.test(heicConversion),
  "HEIC files already classified by name/MIME must not be silently passed through by a second isHeic gate",
);
assert.ok(
  heicConversion.includes("await hasJpegSignature(blob)"),
  "HEIC conversion must verify that the produced bytes are actually JPEG before upload",
);

const directUploadFetch = /fetch\s*\(\s*[\"'`]\/api\/upload(?:\/|\?|[\"'`])/;
const offenders = walkSourceFiles(join(process.cwd(), "src"))
  .filter((path) => path !== uploadClientPath)
  .filter((path) => directUploadFetch.test(readFileSync(path, "utf8")));

assert.deepEqual(
  offenders,
  [],
  `client code must use uploadMediaFile instead of direct /api/upload fetches: ${offenders.join(", ")}`,
);

const eventWizardMedia = readFileSync(
  join(process.cwd(), "src/components/business/wizard/event/steps/Step3Media.tsx"),
  "utf8",
);
assert.ok(
  eventWizardMedia.includes("await uploadMediaFile(file)"),
  "event wizard media must upload through the shared transport boundary",
);
assert.ok(
  !eventWizardMedia.includes("EVENT_HEIC_UNSUPPORTED_MESSAGE") &&
    !eventWizardMedia.includes("isHeicFile(file)"),
  "event wizard must not reject HEIC before the shared HEIC-to-JPEG transport normalization",
);

const compression = readFileSync(join(process.cwd(), "src/lib/image/compression.ts"), "utf8");
assert.ok(
  compression.includes("replaceUploadFilenameExtension(file.name, outputMimeType)"),
  "compressed upload filenames must match the encoded MIME type",
);

console.log("upload pipeline contract tests: OK");
