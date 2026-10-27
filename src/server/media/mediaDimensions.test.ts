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

  // In-memory MediaAsset table that evaluates the subset of Prisma `where` we use.
  type Row = { id: string; filename: string; storageKey: string; publicUrl: string | null; width: number | null; height: number | null; deletedAt: null };
  const table: Row[] = [
    { id: "cmedia000000000000000000a1", filename: "poster-a.webp", storageKey: "/api/media/file/poster-a.webp", publicUrl: "/api/media/file/poster-a.webp", width: 800, height: 1131, deletedAt: null },
    { id: "cmedia000000000000000000b2", filename: "poster b.webp", storageKey: "/api/media/file/poster%20b.webp", publicUrl: "/api/media/file/poster%20b.webp", width: 1600, height: 900, deletedAt: null },
    { id: "cmedia000000000000000000c3", filename: "no-dims.webp", storageKey: "/api/media/file/no-dims.webp", publicUrl: null, width: null, height: null, deletedAt: null },
  ];
  type Where = { OR: Array<Record<string, { in: string[] }>> };
  let queries = 0;
  const db = {
    mediaAsset: {
      findMany: (async ({ where }: { where: Where }) => {
        queries++;
        return table.filter((row) =>
          row.width != null && row.height != null &&
          where.OR.some((clause) => Object.entries(clause).some(([field, cond]) => cond.in.includes(String(row[field as keyof Row])))),
        );
      }) as never,
    },
  };

  const a = "/api/media/file/poster-a.webp";
  const dims = await loadImageDimensionsByUrl(
    [
      a,
      ` ${a} `,
      "https://mamago.by/api/media/file/poster-a.webp", // absolute canonical URL
      "/api/media/cmedia000000000000000000b2", // proxy by MediaAsset id
      "/api/media/poster-a.webp", // proxy by filename
      "/api/media/poster%20b.webp", // proxy by encoded filename
      "/api/media/file/no-dims.webp", // asset without dimensions
      "/api/media/unknown.webp",
      null,
      "",
    ],
    db,
  );
  assert.equal(queries, 1, "one batch query");
  assert.deepEqual(dims.get(a), { width: 800, height: 1131 });
  assert.deepEqual(dims.get("https://mamago.by/api/media/file/poster-a.webp"), { width: 800, height: 1131 });
  assert.deepEqual(dims.get("/api/media/cmedia000000000000000000b2"), { width: 1600, height: 900 });
  assert.deepEqual(dims.get("/api/media/poster-a.webp"), { width: 800, height: 1131 });
  assert.deepEqual(dims.get("/api/media/poster%20b.webp"), { width: 1600, height: 900 });
  assert.equal(dims.has("/api/media/file/no-dims.webp"), false);
  assert.equal(dims.has("/api/media/unknown.webp"), false);

  const withDims = await withImageDimensions(
    [{ image: a }, { image: "/api/media/cmedia000000000000000000b2" }, { image: "https://family.by/x.jpg" }],
    (item) => item.image,
    db,
  );
  assert.equal(withDims[0]!.imageWidth, 800);
  assert.equal(withDims[1]!.imageHeight, 900);
  assert.equal(withDims[2]!.imageWidth, null);

  const emptyDb = { mediaAsset: { findMany: (async () => { throw new Error("must not query"); }) as never } };
  assert.equal((await loadImageDimensionsByUrl([null, undefined], emptyDb)).size, 0);

  // Backfill CLI contract.
  assert.throws(() => parseBackfillArgs([]));
  assert.throws(() => parseBackfillArgs(["--dry-run", "--confirm-writes"]));
  assert.deepEqual(parseBackfillArgs(["--dry-run"]), { dryRun: true, limit: null, batch: 200 });
  assert.deepEqual(parseBackfillArgs(["--confirm-writes", "--limit", "10", "--batch", "5"]), { dryRun: false, limit: 10, batch: 5 });
  assert.throws(() => parseBackfillArgs(["--dry-run", "--limit", "0"]));

  console.log("Media dimensions: header read, EXIF orientation, batch lookup (storage + /api/media proxy by id/filename), backfill CLI: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
