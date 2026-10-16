export type BusinessPublicationKind = "place" | "event" | "offer";

export type BusinessOnboardingPublication = {
  id: string;
  title: string;
  kind: BusinessPublicationKind;
  status: string;
  slug?: string | null;
};

export type BusinessOnboardingStoredState = {
  startedAt: string | null;
  tourCompletedAt: string | null;
  tourSkippedAt: string | null;
  firstPublicViewedAt: string | null;
};

export type BusinessOnboardingSnapshot = {
  showLaunchpad: boolean;
  startedAt: string | null;
  tourCompleted: boolean;
  tourSkipped: boolean;
  viewedPublished: boolean;
  draft: BusinessOnboardingPublication | null;
  pending: BusinessOnboardingPublication | null;
  published: BusinessOnboardingPublication | null;
  total: number;
  done: number;
  hasAny: boolean;
};

const isLive = (status: string) => status === "PUBLISHED" || status === "PENDING_UPDATE";
const isDraft = (status: string) => status === "DRAFT" || status === "NEEDS_REVISION" || status === "REJECTED";
const isPending = (status: string) => status === "PENDING";

export function businessPublicPath(item: BusinessOnboardingPublication): string | null {
  if (!item.slug || !isLive(item.status)) return null;
  // Event URLs are city-scoped (/{city}/events/{slug}); resolve them on the server.
  if (item.kind === "event") return null;
  const section = item.kind === "place" ? "places" : "offers";
  return `/${section}/${encodeURIComponent(item.slug)}`;
}

/**
 * Domain progress is derived from publications, not user-clicked checkboxes.
 * Existing businesses with published content do not get forced back into onboarding.
 * New businesses stay in the launchpad after publishing until they open their card.
 */
export function buildBusinessOnboardingSnapshot(
  publications: BusinessOnboardingPublication[],
  state: BusinessOnboardingStoredState | null,
): BusinessOnboardingSnapshot {
  const draft = publications.find((item) => isDraft(item.status)) ?? null;
  const pending = publications.find((item) => isPending(item.status)) ?? null;
  const published = publications.find((item) => isLive(item.status)) ?? null;
  const startedAt = state?.startedAt ?? null;
  const viewedPublished = Boolean(state?.firstPublicViewedAt);
  const hasAny = publications.length > 0;
  const done = 1 + Number(hasAny) + Number(Boolean(published)) + Number(Boolean(published) && viewedPublished);

  return {
    showLaunchpad: !published || (Boolean(startedAt) && !viewedPublished),
    startedAt,
    tourCompleted: Boolean(state?.tourCompletedAt),
    tourSkipped: Boolean(state?.tourSkippedAt),
    viewedPublished,
    draft,
    pending,
    published,
    total: 4,
    done,
    hasAny,
  };
}
