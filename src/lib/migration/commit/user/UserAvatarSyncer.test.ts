import assert from "node:assert/strict";

import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import type { ImportMediaFromUrlInput, ImportedMediaResult, MediaImporterLike } from "../../media/types";
import type { CreateLineageInput, CreateLineageResult } from "../../lineage/types";
import { classifyVoxelAvatarSource } from "./voxelAvatarSource";
import { UserAvatarSyncer, type UserAvatarSyncerPrismaClient } from "./UserAvatarSyncer";

const attachment: WordPressAttachmentRow = {
  ID: 555,
  post_title: "avatar",
  post_name: "avatar-555",
  post_mime_type: "image/jpeg",
  guid: "https://mamago.by/?attachment_id=555",
  post_parent: 0,
  attached_file: "2024/01/avatar-555.jpg",
};

/** Minimal in-memory fake of everything UserAvatarSyncer touches. Every mutation is inspectable afterwards. */
function createHarness(initialAvatarUrl: string | null = null) {
  const users = new Map<string, { id: string; avatarUrl: string | null; email: string }>([
    ["user-1", { id: "user-1", avatarUrl: initialAvatarUrl, email: "anna@example.com" }],
  ]);
  const mediaAssets = new Map<string, { id: string; publicUrl: string | null; deletedAt: Date | null }>();
  const lineageRows: Array<{ sourceId: string; sourceRecordKey: string; targetType: string; targetId: string; isActive: boolean }> = [];
  const updateManyCalls: Array<{ where: unknown; data: unknown }> = [];
  const importFromUrlCalls: ImportMediaFromUrlInput[] = [];
  const uploadedByUserIds: string[] = [];
  let nextMediaId = 1;

  const prisma: UserAvatarSyncerPrismaClient = {
    user: {
      updateMany: (async ({ where, data }: { where: { id: string; avatarUrl: null }; data: { avatarUrl: string } }) => {
        updateManyCalls.push({ where, data });
        const user = users.get(where.id);
        if (!user) return { count: 0 };
        if (where.avatarUrl === null && user.avatarUrl !== null) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      }) as unknown as UserAvatarSyncerPrismaClient["user"]["updateMany"],
      findUnique: (async ({ where }: { where: { id: string } }) => {
        const user = users.get(where.id);
        return user ? { avatarUrl: user.avatarUrl } : null;
      }) as unknown as UserAvatarSyncerPrismaClient["user"]["findUnique"],
    },
    mediaAsset: {
      findFirst: (async ({ where }: { where: { id: string } }) => {
        const asset = mediaAssets.get(where.id);
        if (!asset || asset.deletedAt) return null;
        return { id: asset.id, publicUrl: asset.publicUrl };
      }) as unknown as UserAvatarSyncerPrismaClient["mediaAsset"]["findFirst"],
    },
    migrationLineage: {
      findFirst: (async ({ where }: { where: { sourceId: string; sourceRecordKey: string; targetType: string; isActive: boolean } }) => {
        const row = lineageRows.find(
          (r) => r.sourceId === where.sourceId && r.sourceRecordKey === where.sourceRecordKey && r.targetType === where.targetType && r.isActive === where.isActive,
        );
        return row ? { targetId: row.targetId } : null;
      }) as unknown as UserAvatarSyncerPrismaClient["migrationLineage"]["findFirst"],
    },
  };

  const mediaImporterFactory = (uploadedByUserId: string): MediaImporterLike => {
    uploadedByUserIds.push(uploadedByUserId);
    return {
      importFromUrl: async (input: ImportMediaFromUrlInput): Promise<ImportedMediaResult> => {
        importFromUrlCalls.push(input);
        const mediaId = `media-${nextMediaId++}`;
        const publicUrl = `https://cdn.mamago.by/${mediaId}.webp`;
        mediaAssets.set(mediaId, { id: mediaId, publicUrl, deletedAt: null });
        return { mediaId, storageKey: publicUrl, publicUrl, width: 200, height: 200 };
      },
    };
  };

  const lineageWriter = {
    createLineage: async (input: CreateLineageInput): Promise<CreateLineageResult> => {
      lineageRows.push({
        sourceId: input.sourceId,
        sourceRecordKey: input.sourceRecordKey,
        targetType: input.targetType,
        targetId: input.targetId,
        isActive: true,
      });
      return { lineageId: `lineage-${lineageRows.length}`, sourceRecordKey: input.sourceRecordKey, targetType: input.targetType, targetId: input.targetId };
    },
  };

  const syncer = new UserAvatarSyncer({ prisma, mediaImporterFactory, lineageWriter });
  return { syncer, users, updateManyCalls, importFromUrlCalls, uploadedByUserIds, mediaAssets };
}

const attachmentsById = new Map([[555, attachment]]);
const baseInput = { userId: "user-1", sourceRecordKey: "wordpress-db:user:1", sourceId: "source-1", sourceHash: "hash-1" };

async function testValidAvatarPopulatesAvatarUrl() {
  const h = createHarness(null);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "555", attachmentsById });
  const result = await h.syncer.sync({ ...baseInput, avatarSource });

  assert.equal(result.outcome, "AVATAR_IMPORTED");
  assert.equal(h.users.get("user-1")?.avatarUrl, result.avatarUrl);
  assert.ok(result.avatarUrl?.startsWith("https://cdn.mamago.by/"));
}

async function testUploadedByIdIsTargetUser() {
  const h = createHarness(null);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "555", attachmentsById });
  await h.syncer.sync({ ...baseInput, avatarSource });

  assert.deepEqual(h.uploadedByUserIds, ["user-1"]);
}

async function testMissingAttachmentIsExplainedSkip() {
  const h = createHarness(null);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "999", attachmentsById });
  const result = await h.syncer.sync({ ...baseInput, avatarSource });

  assert.equal(result.outcome, "AVATAR_SKIPPED_ATTACHMENT_MISSING");
  assert.equal(result.avatarUrl, null);
  assert.equal(h.users.get("user-1")?.avatarUrl, null);
  assert.equal(h.importFromUrlCalls.length, 0);
  assert.equal(result.warnings[0]?.code, "AVATAR_ATTACHMENT_MISSING");
}

async function testTelegramOnlyIsIgnored() {
  const h = createHarness(null);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "https://t.me/i/userpic/320/example.jpg", attachmentsById });
  const result = await h.syncer.sync({ ...baseInput, avatarSource });

  assert.equal(result.outcome, "AVATAR_SKIPPED_NON_ATTACHMENT_VALUE");
  assert.equal(h.users.get("user-1")?.avatarUrl, null);
  assert.equal(h.importFromUrlCalls.length, 0);
}

async function testGravatarOrDefaultIsIgnored() {
  const h = createHarness(null);
  const gravatar = classifyVoxelAvatarSource({ rawMetaValue: "https://www.gravatar.com/avatar/abc123", attachmentsById });
  const mystery = classifyVoxelAvatarSource({ rawMetaValue: "mystery-man", attachmentsById });

  const resultGravatar = await h.syncer.sync({ ...baseInput, avatarSource: gravatar });
  const resultMystery = await h.syncer.sync({ ...baseInput, avatarSource: mystery });

  assert.equal(resultGravatar.outcome, "AVATAR_SKIPPED_NON_ATTACHMENT_VALUE");
  assert.equal(resultMystery.outcome, "AVATAR_SKIPPED_NON_ATTACHMENT_VALUE");
  assert.equal(h.users.get("user-1")?.avatarUrl, null);
  assert.equal(h.importFromUrlCalls.length, 0);
}

async function testNoAvatarLeavesAvatarUrlUnchanged() {
  const h = createHarness(null);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: null, attachmentsById });
  const result = await h.syncer.sync({ ...baseInput, avatarSource });

  assert.equal(result.outcome, "AVATAR_SKIPPED_NO_SOURCE");
  assert.equal(h.users.get("user-1")?.avatarUrl, null);
  assert.equal(h.updateManyCalls.length, 0);
}

async function testRerunIsIdempotent() {
  const h = createHarness(null);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "555", attachmentsById });

  const first = await h.syncer.sync({ ...baseInput, avatarSource });
  assert.equal(first.outcome, "AVATAR_IMPORTED");
  assert.equal(h.importFromUrlCalls.length, 1);

  const second = await h.syncer.sync({ ...baseInput, avatarSource });
  assert.equal(second.outcome, "AVATAR_ALREADY_UP_TO_DATE");
  assert.equal(second.avatarUrl, first.avatarUrl);
  // No second download/MediaAsset was created for the same attachment.
  assert.equal(h.importFromUrlCalls.length, 1);
  assert.equal(h.mediaAssets.size, 1);
}

async function testRerunNeverOverwritesAnExistingDifferentAvatar() {
  // Simulates the user having uploaded their own avatar in the app after migration created the User.
  const h = createHarness("https://cdn.mamago.by/user-uploaded.webp");
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "555", attachmentsById });
  const result = await h.syncer.sync({ ...baseInput, avatarSource });

  assert.equal(result.outcome, "AVATAR_SKIPPED_EXISTING_VALUE");
  assert.equal(h.users.get("user-1")?.avatarUrl, "https://cdn.mamago.by/user-uploaded.webp");
}

async function testExistingUserIsNeverRecreated() {
  // UserAvatarSyncerPrismaClient exposes no `create` method at all — the
  // type itself makes recreation impossible. This test documents that
  // guarantee by confirming a fake with no `create` satisfies the
  // interface and a normal sync() still succeeds.
  const h = createHarness(null);
  assert.equal("create" in h.syncer, false);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "555", attachmentsById });
  const result = await h.syncer.sync({ ...baseInput, avatarSource });
  assert.equal(result.outcome, "AVATAR_IMPORTED");
}

async function testUnrelatedUserFieldsAreNeverTouched() {
  const h = createHarness(null);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "555", attachmentsById });
  await h.syncer.sync({ ...baseInput, avatarSource });

  assert.equal(h.updateManyCalls.length, 1);
  const dataKeys = Object.keys(h.updateManyCalls[0].data as object);
  assert.deepEqual(dataKeys, ["avatarUrl"]);
  assert.equal(h.users.get("user-1")?.email, "anna@example.com");
}

async function testMediaLineageIsReusedAcrossTwoDifferentSourceRecordKeys() {
  // Same physical attachment id, e.g. reused by a second user record or a
  // rerun with a different sourceRecordKey label — dedup is keyed by the
  // WordPress attachment id only, not by which user is asking.
  const h = createHarness(null);
  const avatarSource = classifyVoxelAvatarSource({ rawMetaValue: "555", attachmentsById });
  await h.syncer.sync({ ...baseInput, avatarSource });
  assert.equal(h.importFromUrlCalls.length, 1);

  h.users.set("user-2", { id: "user-2", avatarUrl: null, email: "b@example.com" });
  const result2 = await h.syncer.sync({ ...baseInput, userId: "user-2", sourceRecordKey: "wordpress-db:user:2", avatarSource });
  assert.equal(result2.outcome, "AVATAR_MEDIA_REUSED");
  assert.equal(h.importFromUrlCalls.length, 1);
}

async function main() {
  await testValidAvatarPopulatesAvatarUrl();
  await testUploadedByIdIsTargetUser();
  await testMissingAttachmentIsExplainedSkip();
  await testTelegramOnlyIsIgnored();
  await testGravatarOrDefaultIsIgnored();
  await testNoAvatarLeavesAvatarUrlUnchanged();
  await testRerunIsIdempotent();
  await testRerunNeverOverwritesAnExistingDifferentAvatar();
  await testExistingUserIsNeverRecreated();
  await testUnrelatedUserFieldsAreNeverTouched();
  await testMediaLineageIsReusedAcrossTwoDifferentSourceRecordKeys();
}

main()
  .then(() => console.log("UserAvatarSyncer tests: OK"))
  .catch((error) => {
    console.error("UserAvatarSyncer tests: FAILED", error);
    process.exitCode = 1;
  });
