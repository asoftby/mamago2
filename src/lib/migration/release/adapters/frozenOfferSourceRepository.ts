import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeOffer } from "../../adapters/wordpress-db/normalizeOffer";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import type { WordPressOfferBundle } from "../../adapters/wordpress-db/types";
import type { RawOfferSourceRepository } from "./offersProductionWiring";

export const PHOENIX_RELEASE_ARTIFACT_ROOT_ENV = "PHOENIX_RELEASE_ARTIFACT_ROOT";
const OFFER_CAPTURE_RELATIVE_PATH = "offers/capture.json";
const SUPPORTED_SCHEMA_VERSION = 1;

interface FrozenOfferRecord {
  sourceRecordKey: string;
  sourceEntityType: string;
  sourceHash: string;
  sourceStableKey: string;
  sourceUpdatedAt: string;
  rawPayload: WordPressOfferBundle;
}

interface FrozenOfferCapture {
  schemaVersion: number;
  entity: string;
  capturedAt: string;
  records: FrozenOfferRecord[];
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

function assertRequiredRecordShape(value: unknown): asserts value is FrozenOfferRecord {
  if (!value || typeof value !== "object") throw failed("MALFORMED_OFFER_RECORD");
  const record = value as Partial<FrozenOfferRecord>;
  if (
    !nonEmptyString(record.sourceRecordKey) ||
    !nonEmptyString(record.sourceEntityType) ||
    !nonEmptyString(record.sourceHash) ||
    !nonEmptyString(record.sourceStableKey) ||
    !nonEmptyString(record.sourceUpdatedAt) ||
    !record.rawPayload ||
    typeof record.rawPayload !== "object"
  ) throw failed("MALFORMED_OFFER_RECORD");

  const payload = record.rawPayload as Partial<WordPressOfferBundle>;
  if (!payload.post || typeof payload.post !== "object" || !payload.postMeta || typeof payload.postMeta !== "object" || !Array.isArray(payload.terms) || !Array.isArray(payload.placeRelations)) {
    throw failed("MALFORMED_OFFER_RECORD");
  }
  const post = payload.post as unknown as Record<string, unknown>;
  for (const field of ["ID", "post_title", "post_name", "post_content", "post_excerpt", "post_status", "post_type", "post_date", "post_modified"] as const) {
    if (!(field in post) || (field !== "ID" && typeof post[field] !== "string")) throw failed("MALFORMED_OFFER_RECORD");
  }
  if (typeof post.ID !== "number" || !Number.isFinite(post.ID)) throw failed("MALFORMED_OFFER_RECORD");
}

function parseCapture(raw: Buffer): FrozenOfferCapture {
  let value: unknown;
  try {
    value = JSON.parse(raw.toString("utf8"));
  } catch {
    throw failed("MALFORMED_OFFER_ARTIFACT");
  }
  if (!value || typeof value !== "object") throw failed("MALFORMED_OFFER_ARTIFACT");
  const capture = value as Partial<FrozenOfferCapture>;
  if (capture.schemaVersion !== SUPPORTED_SCHEMA_VERSION) throw failed("UNSUPPORTED_OFFER_ARTIFACT_VERSION");
  if (capture.entity !== "offers" || !nonEmptyString(capture.capturedAt) || !Array.isArray(capture.records)) {
    throw failed("MALFORMED_OFFER_ARTIFACT");
  }
  return capture as FrozenOfferCapture;
}

/**
 * Reads the immutable private Phoenix capture (mirrors
 * `FrozenArticleSourceRepository`/`FrozenEventSourceRepository`/
 * `FrozenRouteSourceRepository`'s exact pattern). The same
 * `PHOENIX_RELEASE_ARTIFACT_ROOT` environment variable is used in LOCAL,
 * DEV and PROD after secure transfer of the artifact root — no WordPress
 * fallback exists on this apply path.
 */
export class FrozenOfferSourceRepository implements RawOfferSourceRepository {
  private capture: FrozenOfferCapture | null = null;

  constructor(
    private readonly artifactRoot: string,
    private readonly expectedArtifactSha256: string,
  ) {
    if (!artifactRoot.trim()) throw failed(`MISSING_${PHOENIX_RELEASE_ARTIFACT_ROOT_ENV}`);
    if (!/^[a-f0-9]{64}$/i.test(expectedArtifactSha256)) throw failed("INVALID_OFFER_ARTIFACT_SHA256");
  }

  static fromEnvironment(expectedArtifactSha256: string, env: NodeJS.ProcessEnv = process.env): FrozenOfferSourceRepository {
    return new FrozenOfferSourceRepository(env[PHOENIX_RELEASE_ARTIFACT_ROOT_ENV] ?? "", expectedArtifactSha256);
  }

  loadNormalizedCandidate(sourceRecordKey: string): NormalizedOfferCandidate {
    const capture = this.loadAndVerifyCapture();
    const matches = capture.records.filter((record) => record?.sourceRecordKey === sourceRecordKey);
    if (matches.length === 0) throw failed("OFFER_SOURCE_RECORD_MISSING");
    if (matches.length !== 1) throw failed("DUPLICATE_OFFER_SOURCE_RECORD");
    const record = matches[0];
    assertRequiredRecordShape(record);
    const normalized = normalizeOffer(record.rawPayload);
    if (normalized.sourceRecordKey !== sourceRecordKey) throw failed("OFFER_SOURCE_KEY_MISMATCH");
    return normalized.normalizedPayload as unknown as NormalizedOfferCandidate;
  }

  private loadAndVerifyCapture(): FrozenOfferCapture {
    if (this.capture) return this.capture;
    let raw: Buffer;
    try {
      raw = readFileSync(resolve(this.artifactRoot, OFFER_CAPTURE_RELATIVE_PATH));
    } catch {
      throw failed("OFFER_ARTIFACT_UNREADABLE");
    }
    const actualSha256 = createHash("sha256").update(raw).digest("hex");
    if (actualSha256 !== this.expectedArtifactSha256.toLowerCase()) throw releaseBlocked("OFFER_ARTIFACT_CHECKSUM_MISMATCH");
    this.capture = parseCapture(raw);
    return this.capture;
  }
}
