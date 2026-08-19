import assert from "node:assert/strict";

import type { WordPressAttachmentRow } from "../adapters/wordpress-db/types";
import type { CreateLineageInput, CreateLineageResult } from "../lineage/types";
import { MediaImportWriter } from "./MediaImportWriter";
import type {
  ImportedMediaResult,
  ImportMediaFromUrlInput,
  ImportWordPressAttachmentInput,
  MediaImporterLike,
  MediaLineageWriterLike,
} from "./types";

function attachmentFixture(overrides: Partial<WordPressAttachmentRow> = {}): WordPressAttachmentRow {
  return {
    ID: 555,
    post_title: "Cozy cafe photo",
    post_name: "cozy-cafe-photo",
    post_mime_type: "image/jpeg",
    guid: "https://old.example.com/wp-content/uploads/2020/01/cozy-cafe.jpg",
    post_parent: 301,
    attached_file: null,
    ...overrides,
  };
}

function inputFixture(overrides: Partial<ImportWordPressAttachmentInput> = {}): ImportWordPressAttachmentInput {
  return {
    attachment: attachmentFixture(),
    sourceId: "source-1",
    sourceRecordKey: "wordpress-db:attachment:555",
    sourceEntityType: "wordpress-db:attachment",
    sourceStableKey: "attachment:555",
    sourceHash: "hash-a",
    runId: "run-1",
    recordId: "record-1",
    ...overrides,
  };
}

function createFakeMediaImporter(
  options: { result?: ImportedMediaResult; throwError?: Error } = {},
) {
  const calls: ImportMediaFromUrlInput[] = [];
  const mediaImporter: MediaImporterLike = {
    importFromUrl: async (input) => {
      calls.push(input);
      if (options.throwError) {
        throw options.throwError;
      }
      return (
        options.result ?? {
          mediaId: "media-1",
          storageKey: "media/2026/07/cozy-cafe-abc123.webp",
          publicUrl: "https://mamago.example.com/media/cozy-cafe.webp",
          width: 800,
          height: 600,
        }
      );
    },
  };
  return { mediaImporter, calls };
}

function createFakeLineageWriter(
  options: { result?: CreateLineageResult; throwError?: Error } = {},
) {
  const calls: CreateLineageInput[] = [];
  const lineageWriter: MediaLineageWriterLike = {
    createLineage: async (input) => {
      calls.push(input);
      if (options.throwError) {
        throw options.throwError;
      }
      return (
        options.result ?? {
          lineageId: "lineage-1",
          sourceRecordKey: input.sourceRecordKey,
          targetType: input.targetType,
          targetId: input.targetId,
        }
      );
    },
  };
  return { lineageWriter, calls };
}

async function testHappyPath() {
  const { mediaImporter, calls: importerCalls } = createFakeMediaImporter();
  const { lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  const result = await writer.importWordPressAttachment(inputFixture());

  assert.equal(importerCalls.length, 1);
  assert.equal(importerCalls[0].sourceUrl, "https://old.example.com/wp-content/uploads/2020/01/cozy-cafe.jpg");

  assert.equal(lineageCalls.length, 1);
  assert.equal(lineageCalls[0].targetType, "MEDIA_ASSET");
  assert.equal(lineageCalls[0].targetId, "media-1");
  assert.equal(lineageCalls[0].targetRole, "primary");
  assert.equal(lineageCalls[0].targetStableKey, "media/2026/07/cozy-cafe-abc123.webp");

  assert.deepEqual(result, {
    mediaId: "media-1",
    lineageId: "lineage-1",
    publicUrl: "https://mamago.example.com/media/cozy-cafe.webp",
  });
}

async function testTargetStableKeyUsesStorageKeyNotPublicUrl() {
  const { mediaImporter } = createFakeMediaImporter({
    result: {
      mediaId: "media-2",
      storageKey: "media/2026/07/other-key.webp",
      publicUrl: "https://mamago.example.com/media/other-name.webp",
      width: null,
      height: null,
    },
  });
  const { lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await writer.importWordPressAttachment(inputFixture());

  assert.equal(
    lineageCalls[0].targetStableKey,
    "media/2026/07/other-key.webp",
    "targetStableKey must be the natural storageKey, which survives publicUrl/CDN changes — not publicUrl itself",
  );
}

async function testLastSourceHashPassedUnchanged() {
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await writer.importWordPressAttachment(inputFixture({ sourceHash: "sha256-exact-value" }));

  assert.equal(lineageCalls[0].lastSourceHash, "sha256-exact-value");
}

async function testUsesResolvedAttachedFileUrlNotGuidWhenPresent() {
  // Regression for the real bug (2026-07-16): guid alone resolved to an
  // HTML attachment page on the live site, not the file.
  const { mediaImporter, calls: importerCalls } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await writer.importWordPressAttachment(
    inputFixture({
      attachment: attachmentFixture({
        guid: "https://mamago.by/?attachment_id=5391",
        attached_file: "2023/07/6c616226f44eb482200f63155b374b75.webp",
      }),
    }),
  );

  assert.equal(
    importerCalls[0].sourceUrl,
    "https://mamago.by/wp-content/uploads/2023/07/6c616226f44eb482200f63155b374b75.webp",
  );
}

async function testMissingGuidThrows() {
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await assert.rejects(() =>
    writer.importWordPressAttachment(inputFixture({ attachment: attachmentFixture({ guid: "" }) })),
  );
}

async function testMissingSourceIdThrows() {
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await assert.rejects(() => writer.importWordPressAttachment(inputFixture({ sourceId: "" })));
}

async function testMissingSourceRecordKeyThrows() {
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await assert.rejects(() => writer.importWordPressAttachment(inputFixture({ sourceRecordKey: "" })));
}

async function testMissingSourceEntityTypeThrows() {
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await assert.rejects(() => writer.importWordPressAttachment(inputFixture({ sourceEntityType: "" })));
}

async function testMissingSourceStableKeyThrows() {
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await assert.rejects(() => writer.importWordPressAttachment(inputFixture({ sourceStableKey: "" })));
}

async function testMissingSourceHashThrows() {
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await assert.rejects(() => writer.importWordPressAttachment(inputFixture({ sourceHash: "" })));
}

async function testMediaImporterErrorPropagatesNotSwallowed() {
  const importerError = new Error("download failed");
  const { mediaImporter } = createFakeMediaImporter({ throwError: importerError });
  const { lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await assert.rejects(
    () => writer.importWordPressAttachment(inputFixture()),
    (error: unknown) => error === importerError,
  );
  assert.equal(lineageCalls.length, 0, "lineage must never be written if the media import itself failed");
}

async function testLineageWriterErrorPropagatesNotSwallowed() {
  const lineageError = new Error("lineage db down");
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter({ throwError: lineageError });
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await assert.rejects(
    () => writer.importWordPressAttachment(inputFixture()),
    (error: unknown) => error === lineageError,
  );
}

async function testNoUnrelatedEntityCallsAreMade() {
  // The injected dependencies only expose `importFromUrl`/`createLineage` —
  // structurally there is nothing resembling place/placeImage/article/
  // migrationRecord access for this writer to reach for.
  const { mediaImporter } = createFakeMediaImporter();
  const { lineageWriter } = createFakeLineageWriter();
  const writer = new MediaImportWriter({ mediaImporter, lineageWriter });

  await writer.importWordPressAttachment(inputFixture());

  assert.deepEqual(Object.keys(mediaImporter), ["importFromUrl"]);
  assert.deepEqual(Object.keys(lineageWriter), ["createLineage"]);
}

async function main() {
  await testHappyPath();
  await testTargetStableKeyUsesStorageKeyNotPublicUrl();
  await testLastSourceHashPassedUnchanged();
  await testUsesResolvedAttachedFileUrlNotGuidWhenPresent();
  await testMissingGuidThrows();
  await testMissingSourceIdThrows();
  await testMissingSourceRecordKeyThrows();
  await testMissingSourceEntityTypeThrows();
  await testMissingSourceStableKeyThrows();
  await testMissingSourceHashThrows();
  await testMediaImporterErrorPropagatesNotSwallowed();
  await testLineageWriterErrorPropagatesNotSwallowed();
  await testNoUnrelatedEntityCallsAreMade();
}

main()
  .then(() => {
    console.log("MediaImportWriter tests: OK");
  })
  .catch((error) => {
    console.error("MediaImportWriter tests: FAILED", error);
    process.exitCode = 1;
  });
