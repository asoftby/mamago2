import type { SearchSynonym } from "@prisma/client";

export type { SearchSynonym };

export interface SearchSynonymFormData {
  source: string;
  targets: string[];
  isActive: boolean;
}
