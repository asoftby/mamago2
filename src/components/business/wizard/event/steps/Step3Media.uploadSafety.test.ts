/**
 * Regression guard for business event media uploads.
 *
 * History: hotfix 15169fb1 ("avoid browser crash during photo upload") removed
 * every client-side decode from the event wizard because large phone photos
 * exhausted the renderer before an error could be handled, and it rejected
 * HEIC/HEIF in the wizard. #441 (3af60320) then deliberately moved HEIC->JPEG
 * conversion into the shared upload transport (`uploadMediaFile`), which still
 * decodes HEIC in the browser (heic-to / WASM). The event wizard must therefore
 * no longer reject HEIC itself: that contract is pinned by
 * src/lib/uploads/uploadPipeline.contract.test.ts.
 *
 * What this test still guarantees (the "effective path", not just imports):
 *   1. Step3Media does no decode/preview work of its own (no canvas, bitmap,
 *      FileReader, blob URL, conversion import) and uploads via the shared
 *      transport only.
 *   2. Every upload in Step3Media is preceded by the file-size check, so an
 *      oversized file is rejected before any conversion can start.
 *   3. In the shared path HEIC conversion is conditional (`...IfNeeded`, early
 *      return for non-HEIC) and `heic-to` is lazily imported in exactly one
 *      module, so JPEG/PNG/WebP/AVIF never touch the WASM decoder.
 *
 * Accepted, unverified risk: a very large HEIC on a phone may still OOM the
 * tab during conversion. Tracked in docs/engineering/backlog.md (BACKLOG-175);
 * on failure return server-side conversion or the event-level rejection.
 *
 * Run: pnpm exec tsx src/components/business/wizard/event/steps/Step3Media.uploadSafety.test.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

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

// --- Effective path: size is checked before every upload (so before any conversion) ---

const SIZE_CHECK = "file.size > MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024";

const sizeChecks = [...source.matchAll(new RegExp(SIZE_CHECK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))].map((m) => m.index ?? -1);
const uploadCalls = [...source.matchAll(/withUploadTimeout\(uploadEventMediaFile\(file\)/g)].map((m) => m.index ?? -1);

assert.ok(uploadCalls.length >= 2, `expected the cover and gallery upload calls, found ${uploadCalls.length}`);
assert.ok(sizeChecks.length >= uploadCalls.length, "every upload call needs its own file-size check");

{
  const events = [
    ...sizeChecks.map((index) => ({ index, kind: "check" as const })),
    ...uploadCalls.map((index) => ({ index, kind: "upload" as const })),
  ].sort((a, b) => a.index - b.index);
  let checked = false;
  for (const event of events) {
    if (event.kind === "check") checked = true;
    else {
      assert.ok(checked, "each upload must be preceded by a file-size check that has not already been consumed");
      checked = false;
    }
  }
}

for (const forbidden of ["createImageBitmap", "FileReader", ".arrayBuffer(", "getContext(", "<canvas"]) {
  assert.ok(!source.includes(forbidden), `Event media must not decode/inspect the file itself (${forbidden})`);
}

// --- Effective path: shared conversion is conditional and the only decoder entry point ---

const uploadClient = readFileSync(resolve(process.cwd(), "src/lib/uploads/uploadClient.ts"), "utf8");
assert.ok(
  uploadClient.includes("await convertHeicFileToJpegIfNeeded(file)") && !uploadClient.includes("await convertHeicFileToJpeg(file"),
  "uploadMediaFile must call the conditional converter (convertHeicFileToJpegIfNeeded), never the unconditional one",
);

const heicConversion = readFileSync(resolve(process.cwd(), "src/lib/uploads/heicConversion.ts"), "utf8");
assert.ok(
  /export async function convertHeicFileToJpegIfNeeded[\s\S]*?if \(!isHeicFile\(file\)\) return file;/.test(heicConversion),
  "conversion must return non-HEIC files unchanged before touching the decoder",
);
assert.ok(
  heicConversion.includes('await import("heic-to")'),
  "the HEIC decoder must be imported lazily so non-HEIC uploads never load it",
);

function walkSources(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) files.push(...walkSources(full));
    else if (/\.(?:ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const decoderImporters = walkSources(join(process.cwd(), "src"))
  .filter((file) => !file.endsWith("Step3Media.uploadSafety.test.ts"))
  .filter((file) =>
    /from\s+["']heic-to["']|import\(\s*["']heic-to["']\s*\)|require\(\s*["']heic-to["']\s*\)/.test(
      readFileSync(file, "utf8"),
    ),
  );
assert.deepEqual(
  decoderImporters.map((file) => file.replace(process.cwd() + "/", "")),
  ["src/lib/uploads/heicConversion.ts"],
  "heic-to must be reachable from exactly one module",
);

console.log("Step3Media.uploadSafety.test.ts: OK");
