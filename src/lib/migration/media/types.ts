import type { WordPressAttachmentRow } from "../adapters/wordpress-db/types";
import type { CreateLineageInput, CreateLineageResult } from "../lineage/types";

/** Input to a concrete media importer — one remote file, already resolved to a URL. */
export interface ImportMediaFromUrlInput {
  sourceUrl: string;
  filenameHint?: string | null;
  title?: string | null;
  sourceRecordKey: string;
}

/** What a concrete media importer hands back once the file is actually stored. */
export interface ImportedMediaResult {
  mediaId: string;
  /** The real, unique `MediaAsset.storageKey` — the file's natural key, stable across `publicUrl`/CDN changes. */
  storageKey: string;
  publicUrl: string;
  width?: number | null;
  height?: number | null;
}

/**
 * The narrowest slice of "download + process + store + register" this
 * writer needs — one method. The real implementation
 * (`createMamagoMediaImporter`) hides network/filesystem/media-pipeline
 * calls behind this; tests inject a fake and never touch either.
 */
export interface MediaImporterLike {
  importFromUrl(input: ImportMediaFromUrlInput): Promise<ImportedMediaResult>;
}

/**
 * Narrow enough that PR11's real `MigrationLineageWriter` satisfies this
 * unchanged — this writer never invents its own lineage input shape, it
 * reuses `CreateLineageInput`/`CreateLineageResult` as-is.
 */
export interface MediaLineageWriterLike {
  createLineage(input: CreateLineageInput): Promise<CreateLineageResult>;
}

export interface ImportWordPressAttachmentInput {
  attachment: WordPressAttachmentRow;
  sourceId: string;
  sourceRecordKey: string;
  /** e.g. "wordpress-db:attachment" */
  sourceEntityType: string;
  /** e.g. "attachment:123" */
  sourceStableKey: string;
  sourceHash: string;
  targetRole?: string;
  runId?: string | null;
  recordId?: string | null;
}

export interface ImportWordPressAttachmentResult {
  mediaId: string;
  lineageId: string;
  publicUrl: string;
}
