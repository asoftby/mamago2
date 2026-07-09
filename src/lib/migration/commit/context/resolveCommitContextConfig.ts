import type { MigrationExecutionCandidate } from "../../core/orchestrator";
import type { ArticleCommitContext } from "../article/buildArticleCreateDraft";
import type { EventCommitContext } from "../event/types";
import type { PlaceCommitContext } from "../place/types";

/**
 * Per-`targetType` manual context, layered `defaults` -> per-record
 * `overridesBySourceRecordKey` override. Deliberately not "the required
 * shape" for any of the three — `Partial<...>` everywhere, because a
 * config author may only want to override one field (e.g. `cityId`) per
 * record while leaving everything else to the default. Whether the
 * *merged* result is actually complete enough for a given target type is
 * `resolveCommitContextForExecutionCandidate`'s job to check, not this
 * type's.
 */
export interface MigrationCommitContextConfig {
  defaults?: {
    place?: Partial<PlaceCommitContext>;
    event?: Partial<EventCommitContext>;
    article?: Partial<ArticleCommitContext>;
  };
  overridesBySourceRecordKey?: Record<
    string,
    {
      place?: Partial<PlaceCommitContext>;
      event?: Partial<EventCommitContext>;
      article?: Partial<ArticleCommitContext>;
    }
  >;
}

export interface ResolveCommitContextInput {
  executionCandidate: MigrationExecutionCandidate;
  config: MigrationCommitContextConfig;
}

export type ResolveCommitContextErrorCode = "UNKNOWN_TARGET_TYPE" | "MISSING_REQUIRED_CONTEXT_FIELD";

export type ResolveCommitContextResult =
  | { ok: true; targetType: "PLACE"; context: PlaceCommitContext }
  | { ok: true; targetType: "ACTIVITY"; context: EventCommitContext }
  | { ok: true; targetType: "ARTICLE"; context: ArticleCommitContext }
  | { ok: false; errorCode: ResolveCommitContextErrorCode; errorMessage: string };

function shallowMerge<T extends object>(
  defaultValue: Partial<T> | undefined,
  overrideValue: Partial<T> | undefined,
): Partial<T> {
  return { ...(defaultValue ?? {}), ...(overrideValue ?? {}) };
}

/**
 * Layers `config.defaults`/`config.overridesBySourceRecordKey`
 * (`executionCandidate.planItem.sourceRecordKey` selects the override
 * bucket) into a resolved `PlaceCommitContext`/`EventCommitContext`/
 * `ArticleCommitContext`, dispatched on
 * `executionCandidate.planItem.targetTypeHint`. Never reads a file, never
 * parses JSON, never touches a database or a runner — `config` is already
 * a plain object by the time this function sees it.
 *
 * Required fields are checked *after* merging, not hardcoded per shape:
 * `PlaceCommitContext.createdByUserId` and `EventCommitContext.ownerUserId`
 * are the only fields their respective draft builders actually require
 * (verified against `buildPlaceCreateDraft.ts`/`buildEventCreateDraft.ts`
 * before writing this file) — nothing here invents a new required field.
 * `ArticleCommitContext` has no required fields at all (verified against
 * `buildArticleCreateDraft.ts` — `Article.authorUserId` is nullable), so
 * an entirely empty article context always resolves.
 *
 * An unknown/missing `targetTypeHint`, or a merged context missing a
 * required field, is a typed `{ok:false}` result — never a thrown error.
 */
export function resolveCommitContextForExecutionCandidate(
  input: ResolveCommitContextInput,
): ResolveCommitContextResult {
  const { executionCandidate, config } = input;
  const targetType = executionCandidate.planItem.targetType;
  const sourceRecordKey = executionCandidate.planItem.sourceRecordKey;
  const override = config.overridesBySourceRecordKey?.[sourceRecordKey];

  if (targetType === "PLACE") {
    const context = shallowMerge(config.defaults?.place, override?.place) as PlaceCommitContext;
    if (!context.createdByUserId?.trim()) {
      return {
        ok: false,
        errorCode: "MISSING_REQUIRED_CONTEXT_FIELD",
        errorMessage: `PlaceCommitContext.createdByUserId is missing for "${sourceRecordKey}".`,
      };
    }
    return { ok: true, targetType: "PLACE", context };
  }

  if (targetType === "ACTIVITY") {
    const context = shallowMerge(config.defaults?.event, override?.event) as EventCommitContext;
    if (!context.ownerUserId?.trim()) {
      return {
        ok: false,
        errorCode: "MISSING_REQUIRED_CONTEXT_FIELD",
        errorMessage: `EventCommitContext.ownerUserId is missing for "${sourceRecordKey}".`,
      };
    }
    return { ok: true, targetType: "ACTIVITY", context };
  }

  if (targetType === "ARTICLE") {
    const context = shallowMerge(config.defaults?.article, override?.article) as ArticleCommitContext;
    return { ok: true, targetType: "ARTICLE", context };
  }

  return {
    ok: false,
    errorCode: "UNKNOWN_TARGET_TYPE",
    errorMessage: `No commit context resolution is defined for targetType "${targetType ?? "(none)"}" ("${sourceRecordKey}").`,
  };
}
