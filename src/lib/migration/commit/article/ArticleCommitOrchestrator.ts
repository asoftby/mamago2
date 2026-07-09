import { buildArticleCreateDraft } from "./buildArticleCreateDraft";
import type {
  ArticleCommitBlockReason,
  ArticleCommitContext,
  ArticleCommitWarning,
  ArticleCreateDraft,
  NormalizedArticleCandidate,
} from "./buildArticleCreateDraft";
import type { ArticleCommitResult } from "./ArticleCommitWriter";

/**
 * The narrowest slice of `ArticleCommitWriter` this orchestrator needs —
 * two methods — so tests can inject a fake without constructing a real
 * writer chain underneath it.
 */
export interface ArticleCommitWriterLike {
  createArticleFromDraft(draft: ArticleCreateDraft): Promise<ArticleCommitResult>;
  updateArticleFromDraft(articleId: string, draft: ArticleCreateDraft): Promise<ArticleCommitResult>;
}

export interface ExecuteArticleCommitInput {
  candidate: NormalizedArticleCandidate;
  context: ArticleCommitContext;
  action?: "CREATE" | "UPDATE";
  targetArticleId?: string | null;
}

export interface ExecuteArticleCommitResult {
  ok: boolean;
  status: "CREATED" | "UPDATED" | "BLOCKED" | "FAILED";
  articleId?: string;
  blockReasons?: readonly ArticleCommitBlockReason[];
  warnings?: readonly ArticleCommitWarning[];
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Sequences Article commit work:
 * `buildArticleCreateDraft()` -> `ArticleCommitWriter.create/update...()`.
 *
 * There's also no try/catch around the writer call: `ArticleCommitWriter`
 * (PR22) already returns a typed `ArticleCommitResult` instead of
 * throwing on an infra-level `create()` failure, so this orchestrator just
 * branches on `writeResult.ok` — nothing to catch.
 *
 * No lineage, no `MigrationRecord`, no media/category/tags/slug history,
 * no rollback — that's later PRs, exactly like Place/Event before it.
 */
export class ArticleCommitOrchestrator {
  constructor(private readonly writer: ArticleCommitWriterLike) {}

  async execute(input: ExecuteArticleCommitInput): Promise<ExecuteArticleCommitResult> {
    const draftResult = buildArticleCreateDraft({ candidate: input.candidate, context: input.context });

    if (!draftResult.ok) {
      return { ok: false, status: "BLOCKED", blockReasons: draftResult.reasons };
    }

    const action = input.action ?? "CREATE";
    if (action === "UPDATE" && !input.targetArticleId?.trim()) {
      return {
        ok: false,
        status: "FAILED",
        errorCode: "ARTICLE_UPDATE_TARGET_MISSING",
        errorMessage: "Article UPDATE requires an existing targetArticleId from MigrationLineage.",
      };
    }

    const writeResult =
      action === "UPDATE"
        ? await this.writer.updateArticleFromDraft(input.targetArticleId!, draftResult.draft)
        : await this.writer.createArticleFromDraft(draftResult.draft);

    if (!writeResult.ok) {
      return {
        ok: false,
        status: "FAILED",
        errorCode: writeResult.errorCode,
        errorMessage: writeResult.errorMessage,
      };
    }

    return {
      ok: true,
      status: action === "UPDATE" ? "UPDATED" : "CREATED",
      articleId: writeResult.articleId,
      warnings: draftResult.warnings,
    };
  }
}
