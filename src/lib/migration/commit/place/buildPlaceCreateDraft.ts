import type {
  NormalizedPlaceCandidate,
  PlaceCommitBlockReason,
  PlaceCommitWarning,
  PlaceCommitContext,
  PlaceCreateDraftResult,
} from "./types";

const SHORT_DESC_MAX_LENGTH = 200;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncates on a word boundary where reasonable, appends an ellipsis. Written fresh for Phoenix — not a reuse of the old import module's `resolveShortDesc()`, which is a source-specific text helper, not a shared taxonomy fact. */
function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > maxLength * 0.4 ? truncated.slice(0, lastSpace) : truncated;
  return `${base.trimEnd()}…`;
}

/**
 * `Place.shortDesc` is required. Falls back, in order: explicit WP
 * `short-desc-place` value -> plain-text `excerpt` -> plain-text `content`.
 * `null` only if all three are empty.
 */
function resolvePhoenixShortDesc(candidate: NormalizedPlaceCandidate): string | null {
  const fromShortDescription = candidate.shortDescription?.trim();
  if (fromShortDescription) {
    return truncateWithEllipsis(fromShortDescription, SHORT_DESC_MAX_LENGTH);
  }

  const fromExcerpt = stripHtml(candidate.excerpt ?? "");
  if (fromExcerpt) {
    return truncateWithEllipsis(fromExcerpt, SHORT_DESC_MAX_LENGTH);
  }

  const fromContent = stripHtml(candidate.content ?? "");
  if (fromContent) {
    return truncateWithEllipsis(fromContent, SHORT_DESC_MAX_LENGTH);
  }

  return null;
}

export interface BuildPlaceCreateDraftInput {
  candidate: NormalizedPlaceCandidate;
  context: PlaceCommitContext;
}

/**
 * Pure: `NormalizedPlaceCandidate` + `PlaceCommitContext` -> a
 * `PlaceCreateDraft` ready for `prisma.place.create({ data })`, or the list
 * of reasons it can't be committed yet. No Prisma, no DB reads, no Place
 * row is ever created here.
 */
export function buildPlaceCreateDraft(input: BuildPlaceCreateDraftInput): PlaceCreateDraftResult {
  const reasons: PlaceCommitBlockReason[] = [];

  if (!input.context.createdByUserId) {
    reasons.push({
      code: "MISSING_CREATED_BY",
      message: "PlaceCommitContext has no createdByUserId — this mapper never invents an author.",
    });
  }

  const title = input.candidate.title?.trim();
  if (!title) {
    reasons.push({ code: "MISSING_TITLE", message: "NormalizedPlaceCandidate has no title." });
  }

  const shortDesc = resolvePhoenixShortDesc(input.candidate);
  if (!shortDesc) {
    reasons.push({
      code: "MISSING_SHORT_DESC",
      message: "Could not derive shortDesc from shortDescription, excerpt, or content.",
    });
  }

  // Category is a manual editor choice, never derived from WordPress
  // taxonomies — the two projects' category sets aren't related, so
  // `candidate.sourceTerms` is intentionally not consulted here. It stays
  // available on the candidate for review UI to show as a hint later.
  const category = input.context.category?.trim();
  const warnings: PlaceCommitWarning[] = [];
  if (!category) {
    warnings.push({
      code: "CATEGORY_MISSING_REQUIRES_REVIEW",
      message: "Place has no category. Import is allowed, but an editor must assign category manually later.",
    });
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const description = stripHtml(input.candidate.content ?? "");

  return {
    ok: true,
    draft: {
      title: title!,
      shortDesc: shortDesc!,
      description: description.length > 0 ? description : null,
      ...(category ? { category } : {}),
      status: "PENDING",
      locationSource: "MANUAL",
      createdByUserId: input.context.createdByUserId,
      cityId: input.context.cityId ?? null,
      lat: input.candidate.coordinates?.lat ?? null,
      lng: input.candidate.coordinates?.lng ?? null,
      // `phoneE164` (never the raw `phone` evidence field) — the E.164
      // invariant is enforced by normalizePlace's PLACE_PHONE_INVALID
      // check; an unresolvable phone becomes null here, never a garbage
      // string carried through to the target row.
      phone: input.candidate.phoneE164 ?? null,
      website: null,
      slug: null,
      ...(input.candidate.openingHours ? { openingHours: input.candidate.openingHours } : {}),
    },
    warnings,
  };
}
