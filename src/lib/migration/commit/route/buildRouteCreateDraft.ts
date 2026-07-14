import type { MigrationWarning } from "../../types";
import type { NormalizedRouteCandidate } from "../../adapters/wordpress-db/normalizeRoute";

export type { NormalizedRouteCandidate };

export interface RouteCommitContext {
  cityId?: string | null;
}

export type RouteCommitBlockReasonCode = "MISSING_TITLE" | "MISSING_SLUG" | "MISSING_STOPS";

export interface RouteCommitBlockReason {
  code: RouteCommitBlockReasonCode;
  message: string;
}

export interface RouteCreateDraftStop {
  order: number;
  placeId: null;
  customTitle: string | null;
  note: string;
}

export interface RouteCreateDraft {
  title: string;
  slug: string;
  cityId: string | null;
  status: "DRAFT";
  visibility: "PRIVATE";
  authorId: null;
  seoTitle: string | null;
  stops: readonly RouteCreateDraftStop[];
}

export type RouteCreateDraftResult =
  | { ok: true; draft: RouteCreateDraft; warnings: readonly MigrationWarning[] }
  | { ok: false; reasons: readonly RouteCommitBlockReason[] };

export interface BuildRouteCreateDraftInput {
  candidate: NormalizedRouteCandidate;
  context: RouteCommitContext;
  sourceRecordKey?: string;
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Pure Route draft builder. It maps only fields approved for the Phoenix
 * Route commit pass: Route + ordered RouteStop rows, no stop media, no
 * route-level location JSON, no slug history, no editorial publication.
 */
export function buildRouteCreateDraft(input: BuildRouteCreateDraftInput): RouteCreateDraftResult {
  const { candidate, context, sourceRecordKey } = input;
  const reasons: RouteCommitBlockReason[] = [];

  const title = candidate.title?.trim();
  const slug = candidate.slug?.trim();

  if (!title) {
    reasons.push({ code: "MISSING_TITLE", message: "NormalizedRouteCandidate.title is empty." });
  }
  if (!slug) {
    reasons.push({ code: "MISSING_SLUG", message: "NormalizedRouteCandidate.slug is empty." });
  }
  if (candidate.stops.length === 0) {
    reasons.push({ code: "MISSING_STOPS", message: "NormalizedRouteCandidate.stops is empty." });
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const cityId = trimToNull(context.cityId);
  const warnings: MigrationWarning[] = [];
  if (!cityId) {
    warnings.push({
      code: "ROUTE_CITY_UNRESOLVED",
      message: "Route cityId was not provided by commit context; imported Route remains cityId=null for manual review.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }

  return {
    ok: true,
    draft: {
      title: title!,
      slug: slug!,
      cityId,
      status: "DRAFT",
      visibility: "PRIVATE",
      authorId: null,
      seoTitle: trimToNull(candidate.seo.title),
      stops: [...candidate.stops]
        .sort((a, b) => a.index - b.index)
        .map((stop, index) => ({
          order: index + 1,
          placeId: null,
          customTitle: trimToNull(stop.title),
          note: trimToNull(stop.description) ?? "",
        })),
    },
    warnings,
  };
}
