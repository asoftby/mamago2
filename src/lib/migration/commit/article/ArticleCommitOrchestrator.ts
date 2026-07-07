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
 * one method — so tests can inject a fake without constructing a real
 * writer chain underneath it.
 */
export interface ArticleCommitWriterLike {
  createArticleFromDraft(draft: ArticleCreateDraft): Promise<ArticleCommitResult>;
}

export interface ExecuteArticleCommitInput {
  candidate: NormalizedArticleCandidate;
  context: ArticleCommitContext;
}

export interface ExecuteArticleCommitResult {
  ok: boolean;
  status: "CREATED" | "BLOCKED" | "FAILED";
  articleId?: string;
  blockReasons?: readonly ArticleCommitBlockReason[];
  warnings?: readonly ArticleCommitWarning[];
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Sequences PR21/PR22 into the first working Article commit step:
 * `buildArticleCreateDraft()` -> `ArticleCommitWriter.createArticleFromDraft()`.
 *
 * Unlike `PlaceCommitOrchestrator`/`EventCommitOrchestrator` (PR10/PR19),
 * there is no `CommitOperation`/`targetType`/`action` guard here — this PR
 * only wires the draft builder to the writer, exactly as scoped; a
 * `CommitOperation`-shaped entry point (mirroring Place/Event) is a
 * decision for a later PR, not assumed here.
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

    const writeResult = await this.writer.createArticleFromDraft(draftResult.draft);

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
      status: "CREATED",
      articleId: writeResult.articleId,
      warnings: draftResult.warnings,
    };
  }
}
