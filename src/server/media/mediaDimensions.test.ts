import assert from "node:assert/strict";
import sharp from "sharp";
import { readImageDimensions } from "./readImageDimensions";
import { loadImageDimensionsByUrl, withImageDimensions } from "./loadImageDimensionsByUrl";
import { parseBackfillArgs } from "../../../scripts/backfill-media-dimensions";

async function main() {
  // Plain header read.
  const portrait = await sharp({ create: { width: 210, height: 297, channels: 3, background: "#fff" } }).png().toBuffer();
  assert.deepEqual(await readImageDimensions(portrait), { width: 210, height: 297 });

  // EXIF orientation 6 (rotate 90°): stored landscape, displayed portrait.
  const rotated = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#000" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  assert.deepEqual(await readImageDimensions(rotated), { width: 300, height: 400 });

  // Garbage never throws.
  assert.equal(await readImageDimensions(Buffer.from("not an image")), null);

  // Batch lookup by storageKey/publicUrl; unknown URLs stay unknown.
  let queried: unknown;
  const db = {
    mediaAsset: {
      findMany: (async (args: unknown) => {
        queried = args;
        return [{ storageKey: "/api/media/file/a.webp", publicUrl: "/api/media/file/a.webp", width: 800, height: 1131 }];
      }) as never,
    },
  };
  const dims = await loadImageDimensionsByUrl(["/api/media/file/a.webp", " /api/media/file/a.webp ", null, ""], db);
  assert.deepEqual(dims.get("/api/media/file/a.webp"), { width: 800, height: 1131 });
  assert.deepEqual((queried as { where: { storageKey: { in: string[] } } }).where.storageKey.in, ["/api/media/file/a.webp"]);

  const withDims = await withImageDimensions(
    [{ image: "/api/media/file/a.webp" }, { image: "https://family.by/x.jpg" }],
    (item) => item.image,
    db,
  );
  assert.equal(withDims[0]!.imageWidth, 800);
  assert.equal(withDims[0]!.imageHeight, 1131);
  assert.equal(withDims[1]!.imageWidth, null);

  const emptyDb = { mediaAsset: { findMany: (async () => { throw new Error("must not query"); }) as never } };
  assert.equal((await loadImageDimensionsByUrl([null, undefined], emptyDb)).size, 0);

  // Backfill CLI contract.
  assert.throws(() => parseBackfillArgs([]));
  assert.throws(() => parseBackfillArgs(["--dry-run", "--confirm-writes"]));
  assert.deepEqual(parseBackfillArgs(["--dry-run"]), { dryRun: true, limit: null, batch: 200 });
  assert.deepEqual(parseBackfillArgs(["--confirm-writes", "--limit", "10", "--batch", "5"]), { dryRun: false, limit: 10, batch: 5 });
  assert.throws(() => parseBackfillArgs(["--dry-run", "--limit", "0"]));

  console.log("Media dimensions: header read, EXIF orientation, batch lookup, backfill CLI: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
