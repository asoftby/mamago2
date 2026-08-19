import type { GeoScope, Role } from "@prisma/client";

export type ContentSuccessKind =
  | "event"
  | "place"
  | "offer"
  | "article"
  | "breaking-news";

export type ContentSuccessOutcome =
  | "published"
  | "changes_published"
  | "submitted"
  | "draft_saved";

export type ContentSuccessSurface = "admin" | "business" | "onboarding";

export type ContentSuccessPayload = {
  kind: ContentSuccessKind;
  surface: ContentSuccessSurface;
  outcome: ContentSuccessOutcome;
  id: string;
  returnTo?: string | null;
  role?: Role | null;
  isEdit?: boolean;
  slug?: string | null;
  status?: string | null;
  publicPath?: string | null;
  cityField?: string | null;
  citySlug?: string | null;
  geoScope?: GeoScope | null;
  offerKind?: string | null;
  offerDurationType?: string | null;
  offerCampProgramType?: string | null;
};

export type ResolvedContentLinks = {
  publicUrl: string | null;
  previewUrl: string | null;
  editUrl: string | null;
  listUrl: string;
};

export type ResolvedContentSuccessState = {
  title: string;
  description: string;
  openAction: {
    label: string;
    href: string;
    target: "_blank" | "_self";
  } | null;
  continueEditingAction: {
    label: string;
    href: string;
  } | null;
  listAction: {
    label: string;
    href: string;
  } | null;
};
