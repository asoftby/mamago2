import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeArticle, type NormalizedArticleCandidate } from "../../adapters/wordpress-db/normalizeArticle";
import type { WordPressArticleBundle } from "../../adapters/wordpress-db/types";
import type { RawArticleSourceRepository } from "./articlesProductionWiring";

export const PHOENIX_RELEASE_ARTIFACT_ROOT_ENV = "PHOENIX_RELEASE_ARTIFACT_ROOT";
const ARTICLE_CAPTURE_RELATIVE_PATH = "articles/capture.json";
const SUPPORTED_SCHEMA_VERSION = 1;

interface FrozenArticleRecord {
  sourceRecordKey: string;
  sourceEntityType: string;
  sourceHash: string;
  sourceStableKey: string;
  sourceUpdatedAt: string;
  rawPayload: WordPressArticleBundle;
}

interface FrozenArticleCapture {
  schemaVersion: number;
  entity: string;
  capturedAt: string;
  records: FrozenArticleRecord[];
}

function failed(code: string): Error {
  return new Error(`FAILED:${code}`);
}

function releaseBlocked(code: string): Error {
  return new Error(`RELEASE_BLOCKED:${code}`);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function assertRequiredRecordShape(value: unknown): asserts value is FrozenArticleRecord {
  if (!value || typeof value !== "object") throw failed("MALFORMED_ARTICLE_RECORD");
  const record = value as Partial<FrozenArticleRecord>;
  if (
    !nonEmptyString(record.sourceRecordKey) ||
    !nonEmptyString(record.sourceEntityType) ||
    !nonEmptyString(record.sourceHash) ||
    !nonEmptyString(record.sourceStableKey) ||
    !nonEmptyString(record.sourceUpdatedAt) ||
    !record.rawPayload ||
    typeof record.rawPayload !== "object"
  ) throw failed("MALFORMED_ARTICLE_RECORD");

  const payload = record.rawPayload as Partial<WordPressArticleBundle>;
  if (!payload.post || typeof payload.post !== "object" || !payload.postMeta || typeof payload.postMeta !== "object" || !Array.isArray(payload.terms)) {
    throw failed("MALFORMED_ARTICLE_RECORD");
  }
  const post = payload.post as unknown as Record<string, unknown>;
  for (const field of ["ID", "post_title", "post_name", "post_content", "post_excerpt", "post_status", "post_date", "post_modified"] as const) {
    if (!(field in post) || (field !== "ID" && typeof post[field] !== "string")) throw failed("MALFORMED_ARTICLE_RECORD");
  }
  if (typeof post.ID !== "number" || !Number.isFinite(post.ID)) throw failed("MALFORMED_ARTICLE_RECORD");
}

function parseCapture(raw: Buffer): FrozenArticleCapture {
  let value: unknown;
  try {
    value = JSON.parse(raw.toString("utf8"));
  } catch {
    throw failed("MALFORMED_ARTICLE_ARTIFACT");
  }
  if (!value || typeof value !== "object") throw failed("MALFORMED_ARTICLE_ARTIFACT");
  const capture = value as Partial<FrozenArticleCapture>;
  if (capture.schemaVersion !== SUPPORTED_SCHEMA_VERSION) throw failed("UNSUPPORTED_ARTICLE_ARTIFACT_VERSION");
  if (capture.entity !== "articles" || !nonEmptyString(capture.capturedAt) || !Array.isArray(capture.records)) {
    throw failed("MALFORMED_ARTICLE_ARTIFACT");
  }
  return capture as FrozenArticleCapture;
}

/**
 * Reads the immutable private Phoenix capture. The same environment variable
 * is used in LOCAL, DEV and PROD after secure transfer of the artifact root.
 * No WordPress fallback exists on this apply path.
 */
export class FrozenArticleSourceRepository implements RawArticleSourceRepository {
  private capture: FrozenArticleCapture | null = null;

  constructor(
    private readonly artifactRoot: string,
    private readonly expectedArtifactSha256: string,
  ) {
    if (!artifactRoot.trim()) throw failed(`MISSING_${PHOENIX_RELEASE_ARTIFACT_ROOT_ENV}`);
    if (!/^[a-f0-9]{64}$/i.test(expectedArtifactSha256)) throw failed("INVALID_ARTICLE_ARTIFACT_SHA256");
  }

  static fromEnvironment(expectedArtifactSha256: string, env: NodeJS.ProcessEnv = process.env): FrozenArticleSourceRepository {
    return new FrozenArticleSourceRepository(env[PHOENIX_RELEASE_ARTIFACT_ROOT_ENV] ?? "", expectedArtifactSha256);
  }

  loadNormalizedCandidate(sourceRecordKey: string): NormalizedArticleCandidate {
    const capture = this.loadAndVerifyCapture();
    const matches = capture.records.filter((record) => record?.sourceRecordKey === sourceRecordKey);
    if (matches.length === 0) throw failed("ARTICLE_SOURCE_RECORD_MISSING");
    if (matches.length !== 1) throw failed("DUPLICATE_ARTICLE_SOURCE_RECORD");
    const record = matches[0];
    assertRequiredRecordShape(record);
    const normalized = normalizeArticle(record.rawPayload);
    if (normalized.sourceRecordKey !== sourceRecordKey) throw failed("ARTICLE_SOURCE_KEY_MISMATCH");
    return normalized.normalizedPayload as NormalizedArticleCandidate;
  }

  private loadAndVerifyCapture(): FrozenArticleCapture {
    if (this.capture) return this.capture;
    let raw: Buffer;
    try {
      raw = readFileSync(resolve(this.artifactRoot, ARTICLE_CAPTURE_RELATIVE_PATH));
    } catch {
      throw failed("ARTICLE_ARTIFACT_UNREADABLE");
    }
    const actualSha256 = createHash("sha256").update(raw).digest("hex");
    if (actualSha256 !== this.expectedArtifactSha256.toLowerCase()) throw releaseBlocked("ARTICLE_ARTIFACT_CHECKSUM_MISMATCH");
    this.capture = parseCapture(raw);
    return this.capture;
  }
}
