import type { ExactRecordExecutor } from "../adapter";
import type { PhoenixExpectedRecord, PhoenixRecordResult } from "../types";
import { planLineageOnlyCreateAction, type LineageOnlyTargetState } from "./lineageOnlyPlanner";

/**
 * Thin Phoenix wrapper for the first Articles release onto a FRESH (clean)
 * target environment — 26 records, `CREATE`/`SKIP_UNCHANGED`/`CONFLICT`/
 * `FAILED` only, no `UPDATE` path, mirroring `offersAdapter.ts`'s shape.
 *
 * Simpler than Offers by construction, not by omission: `Article.authorUserId`
 * is nullable and `buildArticleCreateDraft` already treats author resolution
 * as an explicitly deferred, later concern (see its own doc comment) — so
 * this first release has no logical dependency to resolve at all. If/when
 * author assignment becomes part of this release's scope, dependency
 * resolution can be added the same way Offers' was, without changing this
 * executor's CREATE/SKIP_UNCHANGED/CONFLICT/FAILED contract.
 *
 * `domainHash` here is `wordpress-db-domain-v2` from
 * `commit/adapters/wordpress-db/canonicalSourceHash.ts`'s `hashArticleBundle`
 * — the same hash already stored as `sourceHash` in the committed
 * `docs/migration/manifests/phoenix-articles-dev-release-scope-2026-07-31.json`
 * artifact, not a new hash scheme.
 */

export interface ArticlesMigrationCandidate {
  sourceRecordKey: string;
  domainHash: string;
}

export interface ArticlesMigrationWriteResult {
  targetId: string;
}

export interface ArticlesMigrationDependencies {
  loadCandidate(sourceRecordKey: string): ArticlesMigrationCandidate;
  resolveTargetState(candidate: ArticlesMigrationCandidate): Promise<LineageOnlyTargetState>;
  write(candidate: ArticlesMigrationCandidate): Promise<ArticlesMigrationWriteResult>;
}

export class ArticlesPhaseExecutor implements ExactRecordExecutor {
  constructor(private readonly deps: ArticlesMigrationDependencies) {}

  async execute(sourceRecordKey: string, expectedAction: PhoenixExpectedRecord["action"]): Promise<PhoenixRecordResult> {
    try {
      const candidate = this.deps.loadCandidate(sourceRecordKey);
      const target = await this.deps.resolveTargetState(candidate);
      const plan = planLineageOnlyCreateAction(candidate.domainHash, target);

      if (plan.action === "FAILED") {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: plan.reason ?? "FAILED" };
      }
      if (plan.action === "CONFLICT") {
        return { sourceRecordKey, action: expectedAction, outcome: "PROTECTED_CONFLICT", error: plan.reason ?? "CONFLICT" };
      }
      if (plan.action !== expectedAction) {
        return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: `UNEXPECTED_PLAN_ACTION:${plan.action}` };
      }
      if (plan.action === "SKIP_UNCHANGED") {
        return { sourceRecordKey, action: expectedAction, outcome: "SKIPPED" };
      }
      await this.deps.write(candidate);
      return { sourceRecordKey, action: expectedAction, outcome: "CREATED" };
    } catch (error) {
      return { sourceRecordKey, action: expectedAction, outcome: "FAILED", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
