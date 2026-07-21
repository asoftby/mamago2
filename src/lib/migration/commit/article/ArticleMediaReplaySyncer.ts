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
 * attachment-level methods (`findExistingMediaAssets`/
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
      code: "ARTICLE_MEDIA_ATTACHMENT_MISSING" | "ARTICLE_MEDIA_URL_INVALID" | "ARTICLE_MEDIA_DOWNLOAD_FAILED" | "ARTICLE_MEDIA_UNSUPPORTED_MIME";
      message: string;
      details?: Record<string, unknown>;
    };

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
    },
  ) {}

  /**
   * Read-only — never imports. Used by the replay's preflight to check
   * which requested attachments are already backed by a proven
   * `MigrationLineage(MEDIA_ASSET)` row, without risking a download attempt
   * for the ones that aren't.
   */
  async findExistingMediaAssets(input: { ids: readonly number[]; sourceId: string }): Promise<Map<number, ImportedArticleMedia>> {
    const found = new Map<number, ImportedArticleMedia>();
    for (const id of input.ids) {
      const existing = await this.findExistingMediaAssetForAttachment(input.sourceId, id);
      if (existing) found.set(id, existing);
    }
    return found;
  }

  async resolveAndImportAttachments(
    input: ResolveAndImportArticleAttachmentsInput,
  ): Promise<Map<number, ArticleAttachmentImportOutcome>> {
    const outcomes = new Map<number, ArticleAttachmentImportOutcome>();
    if (input.ids.length === 0) return outcomes;

    const attachments = await this.deps.attachmentResolver.getAttachmentsByIds(input.ids);
    const importer = this.deps.mediaImporterFactory(input.ownerUserId);

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
          importer,
          sourceId: input.sourceId,
          sourceHash: input.sourceHash,
          runId: input.runId,
          recordId: input.recordId,
        }),
      );
    }

    return outcomes;
  }

  private async findExistingMediaAssetForAttachment(sourceId: string, attachmentId: number): Promise<ImportedArticleMedia | null> {
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
    if (existingLineage?.targetId) {
      const asset = await this.deps.prisma.mediaAsset.findFirst({
        where: { id: existingLineage.targetId, deletedAt: null },
        select: { id: true, publicUrl: true },
      });
      if (asset?.publicUrl?.trim()) {
        return { mediaId: asset.id, publicUrl: asset.publicUrl.trim() };
      }
    }
    return null;
  }

  private async importOrReuseAttachment(input: {
    attachmentId: number;
    attachment: WordPressAttachmentRow;
    importer: MediaImporterLike;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
  }): Promise<ArticleAttachmentImportOutcome> {
    const existing = await this.findExistingMediaAssetForAttachment(input.sourceId, input.attachmentId);
    if (existing) {
      return { ok: true, reused: true, mediaId: existing.mediaId, publicUrl: existing.publicUrl };
    }

    const attachmentSourceRecordKey = buildWordPressAttachmentSourceRecordKey(input.attachmentId);
    try {
      const writer = new MediaImportWriter({
        mediaImporter: input.importer,
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
      return { ok: true, reused: false, mediaId: result.mediaId, publicUrl: result.publicUrl };
    } catch (error) {
      return {
        ok: false,
        code: "ARTICLE_MEDIA_DOWNLOAD_FAILED",
        message: "Article media import failed.",
        details: {
          attachmentId: input.attachmentId,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
