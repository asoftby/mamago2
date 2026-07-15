export type MigrationRunMode = "DRY_RUN" | "COMMIT";

export type MigrationTargetType =
  | "USER"
  | "USER_PROFILE"
  | "CHILD"
  | "BUSINESS"
  | "BUSINESS_PROFILE"
  | "ORGANIZER"
  | "PLACE"
  | "OFFER"
  | "ACTIVITY"
  | "ARTICLE"
  | "ROUTE"
  | "ROUTE_STOP"
  | "PLACE_REVIEW"
  | "MEDIA_ASSET"
  | "TAXONOMY"
  | "RELATION"
  | "REDIRECT";

export type MigrationPlanAction =
  | "CREATE"
  | "UPDATE"
  | "LINK_EXISTING"
  | "SKIP_UNCHANGED"
  | "SKIP_POLICY"
  | "QUARANTINE"
  | "FAIL";

export type MigrationPlanStatus =
  | "PLANNED"
  | "SKIPPED"
  | "DUPLICATE"
  | "APPLIED"
  | "BOUND"
  | "LINKED"
  | "QUARANTINED"
  | "FAILED";

export type MigrationMediaScope =
  | "USER_PROFILE"
  | "BUSINESS_PROFILE"
  | "PLACE"
  | "ARTICLE"
  | "OFFER_SERVICES"
  | "OFFER_PROGRAMS"
  | "ROUTE"
  | "EVENT";

export type MigrationSeverity = "INFO" | "WARNING" | "ERROR" | "BLOCKER";

export type MigrationReportType =
  | "MACHINE"
  | "HUMAN"
  | "MANUAL_REVIEW"
  | "QUARANTINE";

export type MigrationAdapterCapability =
  | "DISCOVERY"
  | "EXTRACTION"
  | "NORMALIZATION"
  | "VALIDATION_HINTS"
  | "PLAN_HINTS"
  | "MEDIA_EXTRACTION"
  | "RELATION_EXTRACTION"
  | "REDIRECT_EXTRACTION"
  | "SNAPSHOTS"
  | "INCREMENTAL_SYNC";

export interface MigrationAdapterMetadata {
  key: string;
  version: string;
  displayName: string;
  supportedSourceEntityTypes: readonly string[];
  supportedTargetTypes: readonly MigrationTargetType[];
  capabilities: readonly MigrationAdapterCapability[];
  stableIdPolicy: string;
  hashPolicy: string;
  timezonePolicy: string;
  deletionPolicy: string;
}

/**
 * Discovery-time scoping shared between `MigrationRunPlanInput` (the
 * caller's request) and `MigrationAdapterContext` (what the adapter sees) —
 * an adapter may push these down into its own queries for efficiency, and
 * the engine re-applies them afterwards as a safety net regardless.
 */
export interface MigrationDiscoveryFilters {
  entityTypes?: readonly string[];
  limit?: number;
  excludePastEvents?: boolean;
}

export interface MigrationAdapterContext {
  sourceNamespace: string;
  config?: Record<string, unknown>;
  filters?: MigrationDiscoveryFilters;
  now?: Date;
  signal?: AbortSignal;
}

export interface SourceRecordEnvelope {
  sourceEntityType: string;
  sourceStableKey: string;
  sourceRecordKey: string;
  sourceExternalId?: string;
  sourceUrl?: string;
  canonicalSourceUrl?: string;
  sourceUpdatedAt?: string;
  sourceHash?: string;
  rawPayloadRef?: string;
  rawPayload?: unknown;
  metadata?: Record<string, unknown>;
}

export interface NormalizedRecord {
  sourceRecordKey: string;
  sourceEntityType: string;
  targetTypeHint?: MigrationTargetType;
  normalizedPayload: unknown;
  dependencyRefs?: readonly string[];
  mediaRefs?: readonly string[];
  relationRefs?: readonly string[];
  redirectRefs?: readonly string[];
  warnings?: readonly MigrationWarning[];
}

export interface MigrationWarning {
  code: string;
  message: string;
  severity?: Exclude<MigrationSeverity, "ERROR" | "BLOCKER">;
  sourceRecordKey?: string;
  details?: Record<string, unknown>;
}

export interface MigrationError {
  code: string;
  message: string;
  severity?: Extract<MigrationSeverity, "ERROR" | "BLOCKER">;
  sourceRecordKey?: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface MigrationPlanItem {
  sourceRecordKey: string;
  sourceEntityType: string;
  action: MigrationPlanAction;
  status: MigrationPlanStatus;
  targetType?: MigrationTargetType;
  targetRole?: string;
  summary?: Record<string, unknown>;
  warnings?: readonly MigrationWarning[];
  errors?: readonly MigrationError[];
}

/**
 * Diagnostics computed once by the engine (`createMigrationRunPlan`) so
 * every caller (CLI, future review UI, etc.) reads the same numbers instead
 * of recomputing them ad hoc. Optional so a hand-built `MigrationPlan`
 * (e.g. in older tests) remains valid without it.
 */
export interface MigrationPlanStats {
  discoveredCount: number;
  plannedCount: number;
  normalizedCount: number;
  failedCount: number;
  skippedCount: number;
  /** `normalizedCount / discoveredCount`, or 0 when `discoveredCount` is 0. */
  successRate: number;
  actionCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  targetTypeCounts: Record<string, number>;
  sourceEntityTypeCounts: Record<string, number>;
  warningCounts: Record<string, number>;
  durationsMs: {
    discover: number;
    filter: number;
    normalize: number;
    plan: number;
    total: number;
  };
}

export interface MigrationPlan {
  adapterKey: string;
  adapterVersion: string;
  sourceNamespace: string;
  mode: MigrationRunMode;
  createdAt: string;
  records: readonly SourceRecordEnvelope[];
  items: readonly MigrationPlanItem[];
  warnings: readonly MigrationWarning[];
  errors: readonly MigrationError[];
  stats?: MigrationPlanStats;
}

export interface MigrationReportSummary {
  totalRecords: number;
  plannedItems: number;
  warningCount: number;
  errorCount: number;
  blockedItems: number;
}

export interface MigrationReport {
  type: MigrationReportType;
  generatedAt: string;
  adapterKey: string;
  sourceNamespace: string;
  runMode: MigrationRunMode;
  summary: MigrationReportSummary;
  warnings: readonly MigrationWarning[];
  errors: readonly MigrationError[];
  content?: string;
  plan?: MigrationPlan;
}

export interface MigrationAdapter {
  metadata: MigrationAdapterMetadata;
  discoverRecords?(
    context: MigrationAdapterContext,
  ): Promise<readonly SourceRecordEnvelope[]>;
  normalizeRecord?(
    record: SourceRecordEnvelope,
    context: MigrationAdapterContext,
  ): Promise<NormalizedRecord>;
  createPlan?(
    records: readonly NormalizedRecord[],
    context: MigrationAdapterContext,
  ): Promise<MigrationPlan>;
}
