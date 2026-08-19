export type ArticleAuthorshipClassification =
  | "ARTICLE_TARGET_NOT_MIGRATED"
  | "EXACT_AUTHORSHIP_CANDIDATE"
  | "ALREADY_SATISFIED"
  | "EXISTING_AUTHOR_CONFLICT"
  | "ARTICLE_LINEAGE_CONFLICT"
  | "SOURCE_SCOPE_EXCLUDED"
  | "TARGET_ARTICLE_MISSING"
  | "BLOCKED";

export type ArticleLineageState = "ABSENT" | "ACTIVE_SINGLE" | "DUPLICATE_ACTIVE" | "INACTIVE_ONLY" | "WRONG_TARGET_TYPE";

export interface ArticleAuthorshipEntry {
  sourceRecordKey: string;
  sourcePostStatus: string;
  targetUserId: string | null;
  articleLineageState: ArticleLineageState;
  targetArticleId: string | null;
  currentAuthorUserId: string | null;
  classification: ArticleAuthorshipClassification;
  reasonCode: string;
  recommendedNextAction: string;
  evidenceHash: string;
}

export type Slice17Decision = "ARTICLE_GOLDEN_REQUIRED" | "AUTHORSHIP_GOLDEN_READY" | "AUTHORSHIP_ALREADY_SATISFIED" | "BLOCKED";
