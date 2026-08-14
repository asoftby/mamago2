import type { MigrationWarning } from "../../types";
import type { NormalizedRouteCandidate } from "../../adapters/wordpress-db/normalizeRoute";

export type { NormalizedRouteCandidate };

export interface RouteCommitContext {
  cityId?: string | null;
  /**
   * Optional owner used only for imported `MediaAsset` rows attached to
   * RouteStop.photoUrl. Route.authorId remains null by product decision.
   */
  mediaOwnerUserId?: string | null;
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
 * WP `description-location-N` values are raw post HTML (`<p>`, `<br>`,
 * inline tags, entities). `RouteStop.note` is plain text rendered as-is in
 * the express UI/wizard, so tags must not leak into it. Paragraph and line
 * breaks are preserved as newlines; other tags are stripped. Same local-
 * helper pattern as buildPlaceCreateDraft/buildEventCreateDraft.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—")
    .replace(/&#8230;|&hellip;/gi, "…")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  if (candidate.locationRaw?.trim()) {
    warnings.push({
      code: "ROUTE_LEVEL_LOCATION_DROPPED",
      message: "Route-level location remains in normalized raw metadata and is not imported into Route or RouteStop fields.",
      severity: "INFO",
      sourceRecordKey,
    });
  }
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
          note: htmlToPlainText(stop.description ?? ""),
        })),
    },
    warnings,
  };
}
