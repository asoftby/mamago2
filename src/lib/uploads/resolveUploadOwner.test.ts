/**
 * resolveUploadOwnerUserId — the override capability is scoped to exactly
 * one context (ADMIN_ARTICLE) and exactly two roles (ADMIN/MODERATOR); plain
 * `/api/upload` calls (business wizard, avatar, etc.) never send either
 * field and always keep uploadedById = requester's own id. Plus the full
 * acceptance scenario end-to-end: ADMIN B uploads for author A in the
 * ADMIN_ARTICLE context -> MediaAsset.uploadedById === A -> shows up in A's
 * media-picker page, never in B's.
 *
 * Run: set -a; source .env; set +a; NODE_OPTIONS=--conditions=react-server npx tsx src/lib/uploads/resolveUploadOwner.test.ts
 * (--conditions=react-server is required because registerUploadedMedia's import
 * chain reaches a `server-only`-guarded module — same technique as the existing
 * test:branding-media-asset-usage script.)
 */
import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { MediaSourceType } from "@prisma/client";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import { queryMediaPickerPage } from "@/lib/media/mediaPickerQuery";
import { resolveUploadOwnerUserId, UploadOwnerOverrideError } from "./resolveUploadOwner";

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const createdMediaIds: string[] = [];

function isForbidden(error: unknown): boolean {
  return error instanceof UploadOwnerOverrideError && error.code === "FORBIDDEN";
}

async function createUser(label: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `resolve-upload-owner-${label}-${runId}@example.invalid` },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function cleanup() {
  if (createdMediaIds.length > 0) {
    await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}

async function main() {
  try {
    const authorA = await createUser("author-a");
    const adminB = await createUser("admin-b");
    const regularUser = await createUser("regular");

    // --- No override requested: always resolves to the requester's own id,
    // regardless of context (mirrors plain /api/upload, which never sends
    // ownerUserId at all) ---
    assert.equal(
      await resolveUploadOwnerUserId({
        requesterId: regularUser,
        requesterRole: "USER",
        requestedOwnerUserId: null,
        uploadContext: null,
      }),
      regularUser,
    );
    assert.equal(
      await resolveUploadOwnerUserId({
        requesterId: regularUser,
        requesterRole: "USER",
        requestedOwnerUserId: regularUser,
        uploadContext: null,
      }),
      regularUser,
      "requesting your own id back is a no-op, not an override — no context needed",
    );

    // --- Negative 1: USER + ownerUserId -> forbidden, even inside the
    // ADMIN_ARTICLE context (context alone is not enough — role must also hold) ---
    await assert.rejects(
      () =>
        resolveUploadOwnerUserId({
          requesterId: regularUser,
          requesterRole: "USER",
          requestedOwnerUserId: authorA,
          uploadContext: null,
        }),
      isForbidden,
      "USER must never be able to assign an arbitrary uploadedById",
    );
    await assert.rejects(
      () =>
        resolveUploadOwnerUserId({
          requesterId: regularUser,
          requesterRole: "USER",
          requestedOwnerUserId: authorA,
          uploadContext: "ADMIN_ARTICLE",
        }),
      isForbidden,
      "USER must never be able to assign an arbitrary uploadedById, even by forging the ADMIN_ARTICLE context",
    );

    // --- Negative 2: BUSINESS_OWNER + ownerUserId -> forbidden, same treatment ---
    await assert.rejects(
      () =>
        resolveUploadOwnerUserId({
          requesterId: regularUser,
          requesterRole: "BUSINESS_OWNER",
          requestedOwnerUserId: authorA,
          uploadContext: null,
        }),
      isForbidden,
    );
    await assert.rejects(
      () =>
        resolveUploadOwnerUserId({
          requesterId: regularUser,
          requesterRole: "BUSINESS_OWNER",
          requestedOwnerUserId: authorA,
          uploadContext: "ADMIN_ARTICLE",
        }),
      isForbidden,
      "BUSINESS_OWNER must never be able to assign an arbitrary uploadedById, even by forging the ADMIN_ARTICLE context",
    );

    // --- Negative 3: ADMIN + ownerUserId WITHOUT the ADMIN_ARTICLE context
    // -> override not allowed (role alone is not enough — context must also hold) ---
    await assert.rejects(
      () =>
        resolveUploadOwnerUserId({
          requesterId: adminB,
          requesterRole: "ADMIN",
          requestedOwnerUserId: authorA,
          uploadContext: null,
        }),
      isForbidden,
      "ADMIN outside the ADMIN_ARTICLE context must not be able to override the owner — plain /api/upload stays self-scoped",
    );
    await assert.rejects(
      () =>
        resolveUploadOwnerUserId({
          requesterId: adminB,
          requesterRole: "MODERATOR",
          requestedOwnerUserId: authorA,
          uploadContext: null,
        }),
      isForbidden,
      "MODERATOR outside the ADMIN_ARTICLE context must not be able to override the owner either",
    );

    // --- ADMIN + ADMIN_ARTICLE + a nonexistent target user fails closed ---
    await assert.rejects(
      () =>
        resolveUploadOwnerUserId({
          requesterId: adminB,
          requesterRole: "ADMIN",
          requestedOwnerUserId: "nonexistent-user-id-does-not-exist",
          uploadContext: "ADMIN_ARTICLE",
        }),
      (error: unknown) => error instanceof UploadOwnerOverrideError && error.code === "OWNER_NOT_FOUND",
    );

    // --- Positive 4: ADMIN + ADMIN_ARTICLE + author A -> uploadedById = A ---
    const resolvedForAdmin = await resolveUploadOwnerUserId({
      requesterId: adminB,
      requesterRole: "ADMIN",
      requestedOwnerUserId: authorA,
      uploadContext: "ADMIN_ARTICLE",
    });
    assert.equal(resolvedForAdmin, authorA);

    // --- MODERATOR is allowed the same ADMIN_ARTICLE override as ADMIN ---
    const resolvedForModerator = await resolveUploadOwnerUserId({
      requesterId: adminB,
      requesterRole: "MODERATOR",
      requestedOwnerUserId: authorA,
      uploadContext: "ADMIN_ARTICLE",
    });
    assert.equal(resolvedForModerator, authorA);

    // --- Acceptance scenario: ADMIN B uploads for author A end-to-end ---
    // Mirrors exactly what POST /api/upload does after resolving ownerUserId:
    // dedup + registerUploadedMedia with the resolved owner, never the admin's id.
    const ownerUserId = await resolveUploadOwnerUserId({
      requesterId: adminB,
      requesterRole: "ADMIN",
      requestedOwnerUserId: authorA,
      uploadContext: "ADMIN_ARTICLE",
    });
    const asset = await registerUploadedMedia({
      filename: `resolve-upload-owner-test-${runId}.webp`,
      originalName: `resolve-upload-owner-test-${runId}.jpg`,
      mimeType: "image/webp",
      sizeBytes: 1024,
      width: 800,
      height: 600,
      storageKey: `resolve-upload-owner-test/${runId}`,
      publicUrl: `https://example.invalid/resolve-upload-owner-test/${runId}.webp`,
      sourceType: MediaSourceType.ADMIN_UPLOAD,
      uploadedById: ownerUserId,
    });
    createdMediaIds.push(asset.id);

    assert.equal(asset.uploadedById, authorA, "MediaAsset.uploadedById must be author A, not admin B");
    assert.notEqual(asset.uploadedById, adminB);

    const authorAPage = await queryMediaPickerPage({ uploadedById: authorA });
    assert.ok(
      authorAPage.items.some((item) => item.id === asset.id),
      "the file uploaded by admin B for author A must appear in author A's media-picker page",
    );

    const adminBPage = await queryMediaPickerPage({ uploadedById: adminB });
    assert.ok(
      adminBPage.items.every((item) => item.id !== asset.id),
      "the file must never appear in admin B's own media-picker page",
    );

    console.log("resolveUploadOwner.test.ts: OK");
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
