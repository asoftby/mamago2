export type ReleaseStatusValue = "DRAFT" | "PUBLISHED";

export type ReleaseNoteTypeValue =
  | "FEATURE"
  | "FIX"
  | "IMPROVEMENT"
  | "BREAKING"
  | "INTERNAL";

export type ReleaseNoteListItem = {
  id: string;
  type: ReleaseNoteTypeValue;
  title: string;
  description: string | null;
  order: number;
};

export type ReleaseListItem = {
  id: string;
  version: string;
  title: string;
  description: string | null;
  status: ReleaseStatusValue;
  isCurrent: boolean;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: ReleaseNoteListItem[];
};

export type ReleaseNoteInput = {
  type: ReleaseNoteTypeValue;
  title: string;
  description?: string | null;
};

export type CreateReleaseInput = {
  version: string;
  title: string;
  description?: string | null;
  notes: ReleaseNoteInput[];
};

export type UpdateReleaseInput = {
  version?: string;
  title?: string;
  description?: string | null;
  notes?: ReleaseNoteInput[];
};
