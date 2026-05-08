import type { SearchQueryLog } from "@prisma/client";

export type { SearchQueryLog };

export interface ZeroResultQuery {
  query: string;
  count: number;
  lastSearched: Date;
}

export interface SearchQueryLogFormData {
  query: string;
  resultsCount: number;
  clickedEntityId?: string;
  clickedEntityType?: string;
  cityId?: string;
  userId?: string;
  sessionId?: string;
}
