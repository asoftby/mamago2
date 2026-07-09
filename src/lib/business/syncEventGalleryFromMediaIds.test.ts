import assert from "node:assert/strict";

import {
  activityGalleryMatchesIncomingMediaIds,
  replaceActivityGalleryFromMediaIds,
  type EventGalleryPrisma,
} from "./syncEventGalleryFromMediaIds";

type GalleryRow = {
  activityId: string;
  mediaAssetId: string | null;
  url: string;
  sortOrder: number;
};

function createFakePrisma() {
  const assets = new Map([
    ["media-1", { id: "media-1", publicUrl: "/uploads/one.webp", filename: "one.webp", originalName: "one.jpg", storageKey: "/uploads/one.webp" }],
    ["media-2", { id: "media-2", publicUrl: "/uploads/two.webp", filename: "two.webp", originalName: "two.jpg", storageKey: "/uploads/two.webp" }],
    ["media-3", { id: "media-3", publicUrl: "/uploads/three.webp", filename: "three.webp", originalName: "three.jpg", storageKey: "/uploads/three.webp" }],
  ]);
  const rows: GalleryRow[] = [];
  const calls: Array<{ method: string; args: unknown }> = [];
  const prisma: EventGalleryPrisma = {
    mediaAsset: {
      findFirst: (async (args: { where?: { OR?: Array<Record<string, string>> } }) => {
        const ref = args.where?.OR?.map((entry) => Object.values(entry)[0]).find((value) => assets.has(value));
        return ref ? assets.get(ref) ?? null : null;
      }) as unknown as EventGalleryPrisma["mediaAsset"]["findFirst"],
    },
    activityImage: {
      deleteMany: (async (args: { where: { activityId: string } }) => {
        calls.push({ method: "deleteMany", args });
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i]?.activityId === args.where.activityId) rows.splice(i, 1);
        }
        return { count: 0 };
      }) as unknown as EventGalleryPrisma["activityImage"]["deleteMany"],
      create: (async (args: { data: GalleryRow }) => {
        calls.push({ method: "create", args });
        rows.push(args.data);
        return { id: `row-${rows.length}`, ...args.data };
      }) as unknown as EventGalleryPrisma["activityImage"]["create"],
      findMany: (async (args: { where: { activityId: string }; orderBy: { sortOrder: "asc" } }) =>
        rows
          .filter((row) => row.activityId === args.where.activityId)
          .sort((a, b) => a.sortOrder - b.sortOrder)) as unknown as EventGalleryPrisma["activityImage"]["findMany"],
    },
  };
  return { prisma, rows, calls };
}

async function testReplacementDedupesAndKeepsStableOrder() {
  const { prisma, rows, calls } = createFakePrisma();

  await replaceActivityGalleryFromMediaIds({
    prisma,
    activityId: "activity-1",
    rawMediaIds: ["media-1", "media-2", "media-2", "media-3"],
    coverMediaId: "media-1",
  });

  assert.deepEqual(rows, [
    { activityId: "activity-1", mediaAssetId: "media-2", url: "/uploads/two.webp", sortOrder: 0 },
    { activityId: "activity-1", mediaAssetId: "media-3", url: "/uploads/three.webp", sortOrder: 1 },
  ]);
  assert.equal(calls.filter((call) => call.method === "deleteMany").length, 1);
}

async function testRepeatedReplacementDoesNotDuplicateRows() {
  const { prisma, rows } = createFakePrisma();

  const input = {
    prisma,
    activityId: "activity-1",
    rawMediaIds: ["media-2", "media-3"],
    coverMediaId: null,
  };
  await replaceActivityGalleryFromMediaIds(input);
  await replaceActivityGalleryFromMediaIds(input);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.sortOrder), [0, 1]);
  assert.equal(
    await activityGalleryMatchesIncomingMediaIds({
      prisma,
      activityId: "activity-1",
      rawMediaIds: ["media-2", "media-3"],
      coverMediaId: null,
    }),
    true,
  );
}

async function main() {
  await testReplacementDedupesAndKeepsStableOrder();
  await testRepeatedReplacementDoesNotDuplicateRows();
}

main()
  .then(() => {
    console.log("syncEventGalleryFromMediaIds tests: OK");
  })
  .catch((error) => {
    console.error("syncEventGalleryFromMediaIds tests: FAILED", error);
    process.exitCode = 1;
  });
