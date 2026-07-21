import type { PrismaClient } from "@prisma/client";

import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import { buildWordPressAttachmentSourceRecordKey } from "../../place-media/attachmentSourceRecordKey";
import { MediaImportWriter } from "../../media/MediaImportWriter";
import type { MediaImporterLike, MediaLineageWriterLike } from "../../media/types";

/**
 * Article media replay's own attachment-level resolve/import/reuse — not a
 * general-purpose `ArticleMediaSyncer` wired into the normal Article
 * CREATE/UPDATE commit path (that path never touches media at all today,
 * by design; see `buildArticleCreateDraft.ts`). Deliberately narrow, built
 * for `strictArticleMediaReplay.ts` only, mirroring `EventMediaSyncer`'s
 * attachment-level methods (`checkAttachmentLineageStates`/
 * `resolveAndImportAttachments`) so the resolve/import/dedup logic isn't
 * reinvented — just the entity-specific plumbing around it.
 *
 * A single constant `targetRole` (like `PlaceMediaSyncer`'s `"place-media"`)
 * is used for every Article attachment, regardless of whether it ends up as
 * `Article.coverImageId` or an inline `contentJson` image block: the same
 * physical file can be the cover for one occurrence and inline for another
 * within the same Article (the featured image often also appears inline —
 * confirmed on the golden fixture), and `MigrationLineage` reuse must work
 * across roles, not just across Articles, exactly like Place.
 */
export const ARTICLE_MEDIA_TARGET_ROLE = "article-media";
const ARTICLE_MEDIA_ATTACHMENT_IMPORT_TRANSACTION_TIMEOUT_MS = 120_000;

export interface ArticleMediaAttachmentImportClaimIdentity {
  sourceId: string;
  sourceRecordKey: string;
  targetRole: typeof ARTICLE_MEDIA_TARGET_ROLE;
}

export type ArticleMediaAttachmentImportClaimResult<T> =
  | { acquired: false }
  | { acquired: true; value: T };

export interface ArticleMediaAttachmentImportCoordinator {
  withClaim<T>(
    identity: ArticleMediaAttachmentImportClaimIdentity,
    operation: () => Promise<T>,
  ): Promise<ArticleMediaAttachmentImportClaimResult<T>>;
}

/**
 * Fail-fast, cross-process coordination for one source attachment. The
 * advisory transaction lock is held while the callback performs the
 * authoritative lineage recheck, upload, MediaAsset registration, and
 * lineage creation. A hash collision can only produce a conservative BUSY
 * refusal for an unrelated import; it cannot permit a duplicate upload.
 */
export class PrismaArticleMediaAttachmentImportCoordinator implements ArticleMediaAttachmentImportCoordinator {
  constructor(private readonly prisma: Pick<PrismaClient, "$transaction">) {}

  async withClaim<T>(
    identity: ArticleMediaAttachmentImportClaimIdentity,
    operation: () => Promise<T>,
  ): Promise<ArticleMediaAttachmentImportClaimResult<T>> {
    const lockKey = JSON.stringify([identity.sourceId, identity.targetRole, identity.sourceRecordKey]);
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ acquired: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtextextended(${lockKey}, 0)) AS acquired
        `;
        if (rows[0]?.acquired !== true) return { acquired: false };
        return { acquired: true, value: await operation() };
      },
      { timeout: ARTICLE_MEDIA_ATTACHMENT_IMPORT_TRANSACTION_TIMEOUT_MS },
    );
  }
}

export interface ArticleMediaAttachmentResolver {
  getAttachmentsByIds(ids: readonly number[]): Promise<Map<number, WordPressAttachmentRow>>;
}

export interface ArticleMediaReplaySyncerPrismaClient {
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst">;
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findFirst">;
}

export interface ImportedArticleMedia {
  mediaId: string;
  publicUrl: string;
}

export type ArticleAttachmentImportOutcome =
  | ({ ok: true; reused: boolean } & ImportedArticleMedia)
  | {
      ok: false;
      code:
        | "ARTICLE_MEDIA_ATTACHMENT_MISSING"
        | "ARTICLE_MEDIA_URL_INVALID"
        | "ARTICLE_MEDIA_DOWNLOAD_FAILED"
        | "ARTICLE_MEDIA_UNSUPPORTED_MIME"
        | "ARTICLE_MEDIA_DANGLING_LINEAGE"
        | "ARTICLE_MEDIA_ATTACHMENT_IMPORT_BUSY";
      message: string;
      details?: Record<string, unknown>;
    };

/**
 * Review finding (PR #68, P1 #3): a plain `existing ? reuse : import` binary
 * silently conflated "no lineage row at all" with "an active lineage row
 * exists but its target MediaAsset is gone" — the latter fell through to a
 * fresh import, which (a) downloads/writes a file before ever knowing
 * `MediaImportWriter`'s `createLineage()` will then throw on the still-active
 * conflicting row (see `MigrationLineageWriter.ts`'s doc comment: an active
 * row for the same natural key always throws, never silently overwritten),
 * and (b) can leave an orphaned file/MediaAsset behind with no lineage
 * pointing at it, breaking idempotency on retry. `DANGLING_ACTIVE_LINEAGE`
 * is now its own state, checked *before* any importer call — never a
 * download attempt for a case this class already knows is unsafe.
 */
export type ExistingAttachmentLineageState =
  | { state: "NO_LINEAGE" }
  | ({ state: "USABLE_LINEAGE" } & ImportedArticleMedia)
  | { state: "DANGLING_ACTIVE_LINEAGE"; lineageTargetId: string };

export interface ResolveAndImportArticleAttachmentsInput {
  ids: readonly number[];
  ownerUserId: string;
  sourceId: string;
  sourceHash: string;
  runId: string | null;
  recordId: string | null;
}

function isUsableHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export class ArticleMediaReplaySyncer {
  constructor(
    private readonly deps: {
      prisma: ArticleMediaReplaySyncerPrismaClient;
      attachmentResolver: ArticleMediaAttachmentResolver;
      mediaImporterFactory: (ownerUserId: string) => MediaImporterLike;
      lineageWriter: MediaLineageWriterLike;
      attachmentImportCoordinator: ArticleMediaAttachmentImportCoordinator;
    },
  ) {}

  /**
   * Read-only — never imports. The single source of truth for every
   * requested attachment's lineage state, checked *before*
   * `resolveAndImportAttachments()` is ever called (see
   * `strictArticleMediaReplay.ts`'s upfront batch preflight, review
   * finding PR #68 follow-up): a per-attachment check *inside* the
   * sequential import loop is not enough — attachment N being
   * `DANGLING_ACTIVE_LINEAGE` must block attachment 1..N-1 from having
   * already been downloaded, which only a single whole-batch read-only
   * pass before any import call can guarantee.
   */
  async checkAttachmentLineageStates(input: { ids: readonly number[]; sourceId: string }): Promise<Map<number, ExistingAttachmentLineageState>> {
    const states = new Map<number, ExistingAttachmentLineageState>();
    for (const id of input.ids) {
      states.set(id, await this.getExistingAttachmentLineageState(input.sourceId, id));
    }
    return states;
  }

  async resolveAndImportAttachments(
    input: ResolveAndImportArticleAttachmentsInput,
  ): Promise<Map<number, ArticleAttachmentImportOutcome>> {
    const outcomes = new Map<number, ArticleAttachmentImportOutcome>();
    if (input.ids.length === 0) return outcomes;

    const attachments = await this.deps.attachmentResolver.getAttachmentsByIds(input.ids);
    let importer: MediaImporterLike | null = null;
    const getImporter = () => (importer ??= this.deps.mediaImporterFactory(input.ownerUserId));

    for (const id of input.ids) {
      const attachment = attachments.get(id);
      if (!attachment) {
        outcomes.set(id, {
          ok: false,
          code: "ARTICLE_MEDIA_ATTACHMENT_MISSING",
          message: "WordPress attachment row was not found.",
          details: { attachmentId: id },
        });
        continue;
      }
      if (!attachment.post_mime_type?.startsWith("image/")) {
        outcomes.set(id, {
          ok: false,
          code: "ARTICLE_MEDIA_UNSUPPORTED_MIME",
          message: "WordPress attachment is not an image.",
          details: { attachmentId: id, mimeType: attachment.post_mime_type },
        });
        continue;
      }
      if (!isUsableHttpUrl(attachment.guid)) {
        outcomes.set(id, {
          ok: false,
          code: "ARTICLE_MEDIA_URL_INVALID",
          message: "WordPress attachment guid is not a valid http(s) URL.",
          details: { attachmentId: id, guid: attachment.guid },
        });
        continue;
      }

      outcomes.set(
        id,
        await this.importOrReuseAttachment({
          attachmentId: id,
          attachment,
          getImporter,
          sourceId: input.sourceId,
          sourceHash: input.sourceHash,
          runId: input.runId,
          recordId: input.recordId,
        }),
      );
    }

    return outcomes;
  }

  private async getExistingAttachmentLineageState(sourceId: string, attachmentId: number): Promise<ExistingAttachmentLineageState> {
    const attachmentSourceRecordKey = buildWordPressAttachmentSourceRecordKey(attachmentId);
    const existingLineage = await this.deps.prisma.migrationLineage.findFirst({
      where: {
        sourceId,
        sourceRecordKey: attachmentSourceRecordKey,
        targetType: "MEDIA_ASSET",
        isActive: true,
      },
      select: { targetId: true },
    });
    if (!existingLineage?.targetId) {
      return { state: "NO_LINEAGE" };
    }
    const asset = await this.deps.prisma.mediaAsset.findFirst({
      where: { id: existingLineage.targetId, deletedAt: null },
      select: { id: true, publicUrl: true },
    });
    if (asset?.publicUrl?.trim()) {
      return { state: "USABLE_LINEAGE", mediaId: asset.id, publicUrl: asset.publicUrl.trim() };
    }
    // An active lineage row exists (isActive: true, unique per sourceId +
    // sourceRecordKey + targetType + targetRole) but its target is gone or
    // unusable — never treat this as "no lineage" and silently re-import.
    return { state: "DANGLING_ACTIVE_LINEAGE", lineageTargetId: existingLineage.targetId };
  }

  private async importOrReuseAttachment(input: {
    attachmentId: number;
    attachment: WordPressAttachmentRow;
    getImporter: () => MediaImporterLike;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
  }): Promise<ArticleAttachmentImportOutcome> {
    const attachmentSourceRecordKey = buildWordPressAttachmentSourceRecordKey(input.attachmentId);
    const claim = await this.deps.attachmentImportCoordinator.withClaim(
      {
        sourceId: input.sourceId,
        sourceRecordKey: attachmentSourceRecordKey,
        targetRole: ARTICLE_MEDIA_TARGET_ROLE,
      },
      async () => {
        // This is the authoritative race-sensitive recheck. The earlier
        // whole-batch pass remains useful for fail-closed preflight, but only
        // this check is protected against another replay importing the same
        // attachment concurrently.
        const existing = await this.getExistingAttachmentLineageState(input.sourceId, input.attachmentId);
        if (existing.state === "USABLE_LINEAGE") {
          return { ok: true, reused: true, mediaId: existing.mediaId, publicUrl: existing.publicUrl } satisfies ArticleAttachmentImportOutcome;
        }
        if (existing.state === "DANGLING_ACTIVE_LINEAGE") {
          return {
            ok: false,
            code: "ARTICLE_MEDIA_DANGLING_LINEAGE",
            message: "An active MEDIA_ASSET lineage row exists for this attachment but its target is missing/deleted — refusing to import before this is resolved.",
            details: { attachmentId: input.attachmentId, lineageTargetId: existing.lineageTargetId },
          } satisfies ArticleAttachmentImportOutcome;
        }

        try {
          const writer = new MediaImportWriter({
            mediaImporter: input.getImporter(),
            lineageWriter: this.deps.lineageWriter,
          });
          const result = await writer.importWordPressAttachment({
            attachment: input.attachment,
            sourceId: input.sourceId,
            sourceRecordKey: attachmentSourceRecordKey,
            sourceEntityType: "wordpress-db:attachment",
            sourceStableKey: `attachment:${input.attachmentId}`,
            sourceHash: input.sourceHash,
            targetRole: ARTICLE_MEDIA_TARGET_ROLE,
            runId: input.runId,
            recordId: input.recordId,
          });
          return { ok: true, reused: false, mediaId: result.mediaId, publicUrl: result.publicUrl } satisfies ArticleAttachmentImportOutcome;
        } catch (error) {
          return {
            ok: false,
            code: "ARTICLE_MEDIA_DOWNLOAD_FAILED",
            message: "Article media import failed.",
            details: {
              attachmentId: input.attachmentId,
              error: error instanceof Error ? error.message : String(error),
            },
          } satisfies ArticleAttachmentImportOutcome;
        }
      },
    );
    if (!claim.acquired) {
      return {
        ok: false,
        code: "ARTICLE_MEDIA_ATTACHMENT_IMPORT_BUSY",
        message: "Another Article replay is already importing this attachment — retry safely after it finishes to reuse the winner's lineage.",
        details: { attachmentId: input.attachmentId, sourceRecordKey: attachmentSourceRecordKey },
      };
    }
    return claim.value;
  }
}
