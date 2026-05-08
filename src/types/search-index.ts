import type { 
  SearchIndexRecord, 
  SearchIndexEntityType, 
  SearchIndexStatus 
} from "@prisma/client";

export type { 
  SearchIndexRecord, 
  SearchIndexEntityType, 
  SearchIndexStatus 
};

export interface SearchIndexStats {
  total: number;
  indexed: number;
  pending: number;
  failed: number;
  excluded: number;
  byType: Record<SearchIndexEntityType, number>;
}

export interface SearchIndexRecordWithEntity extends SearchIndexRecord {
  entityTitle?: string;
  entityUrl?: string;
}
