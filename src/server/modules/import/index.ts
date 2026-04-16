/**
 * Import Module — public API
 */

// Types
export type {
  NormalizedImportPayload,
  NormalizedPlaceImport,
  NormalizedEventImport,
  ParsedRawRecord,
  ParserResult,
  PlaceMatchSignals,
  PlaceMatchCandidate,
  PlaceMatchResult,
  EventMatchSignals,
  EventMatchCandidate,
  EventMatchResult,
  MatchCandidate,
  ReviewDecisionPayload,
  PlaceQualitySignals,
  QualityScoringResult,
  EventQualitySignals,
  EventQualityScoringResult,
  ReviewTaskCreationResult,
  PlaceApplyResult,
  PlaceApplyValidationError,
  ImportApplyResultPayload,
} from "./types";

// Services
export * as ImportSourceService from "./services/import-source.service";
export * as ImportRunService from "./services/import-run.service";
export * as ImportRecordService from "./services/import-record.service";
export * as ImportReviewService from "./services/import-review.service";
export * as ImportPublishService from "./services/import-publish.service";
export * as ImportPipelineService from "./services/import-pipeline.service";
export * as ImportNormalizationService from "./services/import-normalization.service";
export * as ImportQualityService from "./services/import-quality.service";
export * as ImportMatchingService from "./services/import-matching.service";
export * as ImportReviewTaskService from "./services/import-review-task.service";

// Parser registry
export { getParser, listParserKeys } from "./parsers/registry";

// Parser contracts
export type { ImportParser, PlaceImportParser, EventImportParser } from "./parsers/base.parser";
