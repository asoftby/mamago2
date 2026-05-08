import type { SearchQuickTag } from "@prisma/client";

export type { SearchQuickTag };

export interface SearchQuickTagWithCity extends SearchQuickTag {
  city: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface SearchQuickTagFormData {
  title: string;
  slug: string;
  query: string;
  filters?: Record<string, unknown> | null;
  cityId?: string | null;
  isActive: boolean;
  sortOrder: number;
}
