import type { PrismaClient } from "@prisma/client";

import type { ArticleContentPayload } from "@/lib/publications/articleMvp";
import {
  normalizeMigrationContent,
  normalizedContentToArticleContentJsonWithMedia,
} from "../../content";
import type { MigrationWarning } from "../../types";
import type { NormalizedArticleCandidate } from "./buildArticleCreateDraft";
import {
  ArticleMediaReplaySyncer,
  type ArticleMediaReplaySyncerPrismaClient,
  type ArticleMediaAttachmentResolver,
  type ArticleMediaAttachmentImportCoordinator,
} from "./ArticleMediaReplaySyncer";
import type { MediaImporterLike, MediaLineageWriterLike } from "../../media/types";

export interface ArticleFullMediaSyncerPrismaClient extends ArticleMediaReplaySyncerPrismaClient {
  article: Pick<PrismaClient["article"], "findUnique" | "update">;
  $transaction?: PrismaClient["$transaction"];
}

export interface ArticleFullMediaSyncInput {
  articleId: string;
  candidate: NormalizedArticleCandidate;
  ownerUserId: string | null | undefined;
  sourceId: string;
  sourceHash: string | null;
  runId?: string | null;
  recordId?: string | null;
  sourceRecordKey: string;
}

function warning(
  sourceRecordKey: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): MigrationWarning {
  return { code, message, severity: "WARNING", sourceRecordKey, ...(details ? { details } : {}) };
}

/**
 * Best-effort Article media on the normal FULL CREATE/UPDATE path.
 * Reuses ArticleMediaReplaySyncer's import-or-reuse lineage; one broken
 * image never aborts the Article commit. Strict replay remains the
 * recovery tool (`--force-article-media-replay`).
 */
export class ArticleFullMediaSyncer {
  private readonly replay: ArticleMediaReplaySyncer;

  constructor(
    private readonly deps: {
      prisma: ArticleFullMediaSyncerPrismaClient;
      attachmentResolver: ArticleMediaAttachmentResolver;
      mediaImporterFactory: (ownerUserId: string) => MediaImporterLike;
      lineageWriter: MediaLineageWriterLike;
      attachmentImportCoordinator: ArticleMediaAttachmentImportCoordinator;
    },
  ) {
    this.replay = new ArticleMediaReplaySyncer({
      prisma: deps.prisma,
      attachmentResolver: deps.attachmentResolver,
      mediaImporterFactory: deps.mediaImporterFactory,
      lineageWriter: deps.lineageWriter,
      attachmentImportCoordinator: deps.attachmentImportCoordinator,
    });
  }

  async sync(input: ArticleFullMediaSyncInput): Promise<{ warnings: MigrationWarning[] }> {
    const warnings: MigrationWarning[] = [];
    const featured = input.candidate.featuredImageAttachmentId;
    const inline = input.candidate.inlineImageAttachmentIds ?? [];
    const ids = [...new Set([...(featured !== null ? [featured] : []), ...inline])];
    if (ids.length === 0) return { warnings };

    const ownerUserId = input.ownerUserId?.trim();
    if (!ownerUserId) {
      warnings.push(
        warning(input.sourceRecordKey, "ARTICLE_MEDIA_OWNER_MISSING", "Article media skipped: no ownerUserId."),
      );
      return { warnings };
    }

    const outcomes = await this.replay.resolveAndImportAttachments({
      ids,
      ownerUserId,
      sourceId: input.sourceId,
      sourceHash: input.sourceHash ?? input.sourceRecordKey,
      runId: input.runId ?? null,
      recordId: input.recordId ?? null,
    });

    const urlByAttachmentId = new Map<number, { mediaId: string; publicUrl: string }>();
    let failed = 0;
    for (const [id, outcome] of outcomes) {
      if (outcome.ok) {
        urlByAttachmentId.set(id, { mediaId: outcome.mediaId, publicUrl: outcome.publicUrl });
      } else {
        failed += 1;
        warnings.push(
          warning(input.sourceRecordKey, outcome.code, outcome.message, { attachmentId: id, ...outcome.details }),
        );
      }
    }

    const cover = featured !== null ? urlByAttachmentId.get(featured) : undefined;
    const article = await this.deps.prisma.article.findUnique({
      where: { id: input.articleId },
      select: { contentJson: true, coverImageId: true },
    });
    if (!article) {
      warnings.push(warning(input.sourceRecordKey, "ARTICLE_MEDIA_TARGET_MISSING", "Article row was not found after commit."));
      return { warnings };
    }

    let contentJson = article.contentJson as ArticleContentPayload | null;
    try {
      const normalized = normalizeMigrationContent({
        raw: input.candidate.content,
        sourceKind: "wordpress",
        preserveImagePositions: true,
      });
      const rebuilt = normalizedContentToArticleContentJsonWithMedia(normalized, (block) => {
        const attachmentId = block.attachmentId;
        if (attachmentId == null) return null;
        const resolved = urlByAttachmentId.get(attachmentId);
        if (!resolved) return null;
        return { mediaId: resolved.mediaId };
      });
      contentJson = rebuilt.contentJson;
    } catch (error) {
      warnings.push(
        warning(input.sourceRecordKey, "ARTICLE_MEDIA_CONTENT_REBUILD_FAILED", "contentJson media rewrite skipped.", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    await this.deps.prisma.article.update({
      where: { id: input.articleId },
      data: {
        ...(cover ? { coverImageId: cover.mediaId } : {}),
        ...(contentJson ? { contentJson } : {}),
      },
    });

    if (failed > 0) {
      warnings.push(
        warning(input.sourceRecordKey, "ARTICLE_MEDIA_PARTIAL", "One or more Article attachments failed; the Article commit remains successful.", {
          imported: urlByAttachmentId.size,
          failed,
        }),
      );
    }
    return { warnings };
  }
}
