export type PhoenixEnvironment = "LOCAL" | "DEV" | "PROD";
export type PhoenixMode = "PLAN" | "APPLY" | "RERUN";
export type PhoenixPhaseName =
  | "users"
  | "businesses"
  | "places"
  | "offers"
  | "routes"
  | "events"
  | "articles"
  | "redirects";

export interface PhoenixArtifactReference {
  path: string;
  sha256: string;
  executable: boolean;
  description: string;
}

export interface PhoenixExpectedRecord {
  sourceRecordKey: string;
  action: "CREATE" | "UPDATE" | "SKIP_UNCHANGED" | "UPDATE_CONFLICT";
}

export interface PhoenixReleasePhase {
  name: PhoenixPhaseName;
  status: "READY" | "BLOCKED" | "VALIDATION_ONLY";
  artifacts: PhoenixArtifactReference[];
  records: PhoenixExpectedRecord[];
  protectedSourceRecordKeys: string[];
  excludedSourceRecordKeys: string[];
  deterministicConflicts: string[];
  mediaPolicy: "FULL" | "METADATA" | "NONE" | "NOT_APPLICABLE";
  prerequisites: string[];
  blocker?: string;
  /**
   * Machine-readable blocker classification (e.g.
   * `USERS_HISTORICAL_NAME_INPUT_UNRECOVERABLE`,
   * `BLOCKED_BY_DEPENDENCY`). Always paired with a human-readable
   * `blocker` string; never a substitute for it.
   */
  blockerCode?: string;
}

export interface PhoenixReleaseManifest {
  schemaVersion: 1;
  releaseId: string;
  phaseOrder: PhoenixPhaseName[];
  phases: PhoenixReleasePhase[];
}

export interface SafeDatabaseFingerprint {
  environment: PhoenixEnvironment;
  host: string;
  port: string;
  database: string;
  schema: string;
  currentDatabase: string;
}

export interface SafeStorageFingerprint {
  environment: PhoenixEnvironment;
  provider: string;
  locationHash: string;
}

export interface PhoenixEnvironmentContext {
  environment: PhoenixEnvironment;
  database: SafeDatabaseFingerprint;
  storage: SafeStorageFingerprint;
}

export interface PhoenixRecordResult {
  sourceRecordKey: string;
  action: PhoenixExpectedRecord["action"];
  outcome: "CREATED" | "UPDATED" | "SKIPPED" | "PROTECTED_CONFLICT" | "FAILED";
  error?: string;
}

export interface PhoenixPhaseReport {
  releaseId: string;
  environment: PhoenixEnvironment;
  codeSha: string;
  manifestPath: string;
  manifestHash: string;
  phase: PhoenixPhaseName;
  attempted: number;
  created: number;
  updated: number;
  skipped: number;
  protectedConflicts: number;
  failed: number;
  targetCountDelta: number;
  migrationRecordDelta: number;
  migrationLineageDelta: number;
  duplicateLineage: number;
  duplicateTargets: number;
  mediaStorageDelta: number;
  forbiddenTableAudit: "PASS" | "FAIL" | "NOT_RUN";
  firstFailure: string | null;
  completedPrefix: PhoenixPhaseName[];
  environmentFingerprint: PhoenixEnvironmentContext;
  resolvedIdentities: Record<string, string>;
}

export interface PhoenixPhaseAdapter {
  plan(phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]>;
  apply(phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]>;
  reconcile(phase: PhoenixReleasePhase, results: readonly PhoenixRecordResult[]): Promise<Partial<PhoenixPhaseReport>>;
  rerun(phase: PhoenixReleasePhase): Promise<PhoenixRecordResult[]>;
}
