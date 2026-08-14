import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizePlace } from "../../adapters/wordpress-db/normalizePlace";
import type { WordPressPlaceBundle } from "../../adapters/wordpress-db/types";
import type { NormalizedPlaceCandidate } from "../../commit/place/types";
import type { RawPlaceSourceRepository } from "./placesProductionWiring";

export const PHOENIX_RELEASE_ARTIFACT_ROOT_ENV = "PHOENIX_RELEASE_ARTIFACT_ROOT";
const PLACE_CAPTURE_RELATIVE_PATH = "places/capture.json";
const SUPPORTED_SCHEMA_VERSION = 1;

interface FrozenPlaceRecord {
  sourceRecordKey: string;
  sourceEntityType: string;
  sourceHash: string;
  sourceStableKey: string;
  sourceUpdatedAt: string;
  rawPayload: WordPressPlaceBundle;
}

interface FrozenPlaceCapture {
  schemaVersion: number;
  entity: string;
  capturedAt: string;
  records: FrozenPlaceRecord[];
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

function assertRequiredRecordShape(value: unknown): asserts value is FrozenPlaceRecord {
  if (!value || typeof value !== "object") throw failed("MALFORMED_PLACE_RECORD");
  const record = value as Partial<FrozenPlaceRecord>;
  if (
    !nonEmptyString(record.sourceRecordKey) ||
    !nonEmptyString(record.sourceEntityType) ||
    !nonEmptyString(record.sourceHash) ||
    !nonEmptyString(record.sourceStableKey) ||
    !nonEmptyString(record.sourceUpdatedAt) ||
    !record.rawPayload ||
    typeof record.rawPayload !== "object"
  ) throw failed("MALFORMED_PLACE_RECORD");
  const payload = record.rawPayload as Partial<WordPressPlaceBundle>;
  if (!payload.post || typeof payload.post !== "object" || !payload.postMeta || typeof payload.postMeta !== "object" || !Array.isArray(payload.terms)) {
    throw failed("MALFORMED_PLACE_RECORD");
  }
  const post = payload.post as unknown as Record<string, unknown>;
  if (typeof post.ID !== "number" || !Number.isFinite(post.ID) || typeof post.post_author !== "number") throw failed("MALFORMED_PLACE_RECORD");
}

function parseCapture(raw: Buffer): FrozenPlaceCapture {
  let value: unknown;
  try {
    value = JSON.parse(raw.toString("utf8"));
  } catch {
    throw failed("MALFORMED_PLACE_ARTIFACT");
  }
  if (!value || typeof value !== "object") throw failed("MALFORMED_PLACE_ARTIFACT");
  const capture = value as Partial<FrozenPlaceCapture>;
  if (capture.schemaVersion !== SUPPORTED_SCHEMA_VERSION) throw failed("UNSUPPORTED_PLACE_ARTIFACT_VERSION");
  if (capture.entity !== "places" || !nonEmptyString(capture.capturedAt) || !Array.isArray(capture.records)) throw failed("MALFORMED_PLACE_ARTIFACT");
  return capture as FrozenPlaceCapture;
}

/** Mirrors FrozenArticleSourceRepository/FrozenOfferSourceRepository/FrozenEventSourceRepository/FrozenRouteSourceRepository exactly. */
export class FrozenPlaceSourceRepository implements RawPlaceSourceRepository {
  private capture: FrozenPlaceCapture | null = null;

  constructor(
    private readonly artifactRoot: string,
    private readonly expectedArtifactSha256: string,
  ) {
    if (!artifactRoot.trim()) throw failed(`MISSING_${PHOENIX_RELEASE_ARTIFACT_ROOT_ENV}`);
    if (!/^[a-f0-9]{64}$/i.test(expectedArtifactSha256)) throw failed("INVALID_PLACE_ARTIFACT_SHA256");
  }

  static fromEnvironment(expectedArtifactSha256: string, env: NodeJS.ProcessEnv = process.env): FrozenPlaceSourceRepository {
    return new FrozenPlaceSourceRepository(env[PHOENIX_RELEASE_ARTIFACT_ROOT_ENV] ?? "", expectedArtifactSha256);
  }

  private findRecord(sourceRecordKey: string): FrozenPlaceRecord {
    const capture = this.loadAndVerifyCapture();
    const matches = capture.records.filter((record) => record?.sourceRecordKey === sourceRecordKey);
    if (matches.length === 0) throw failed("PLACE_SOURCE_RECORD_MISSING");
    if (matches.length !== 1) throw failed("DUPLICATE_PLACE_SOURCE_RECORD");
    const record = matches[0];
    assertRequiredRecordShape(record);
    return record;
  }

  loadNormalizedCandidate(sourceRecordKey: string): NormalizedPlaceCandidate {
    const record = this.findRecord(sourceRecordKey);
    const normalized = normalizePlace(record.rawPayload);
    if (normalized.sourceRecordKey !== sourceRecordKey) throw failed("PLACE_SOURCE_KEY_MISMATCH");
    return normalized.normalizedPayload as unknown as NormalizedPlaceCandidate;
  }

  loadLegacyAuthorId(sourceRecordKey: string): number {
    const record = this.findRecord(sourceRecordKey);
    return record.rawPayload.post.post_author;
  }

  loadSourceHash(sourceRecordKey: string): string {
    return this.findRecord(sourceRecordKey).sourceHash;
  }

  private loadAndVerifyCapture(): FrozenPlaceCapture {
    if (this.capture) return this.capture;
    let raw: Buffer;
    try {
      raw = readFileSync(resolve(this.artifactRoot, PLACE_CAPTURE_RELATIVE_PATH));
    } catch {
      throw failed("PLACE_ARTIFACT_UNREADABLE");
    }
    const actualSha256 = createHash("sha256").update(raw).digest("hex");
    if (actualSha256 !== this.expectedArtifactSha256.toLowerCase()) throw releaseBlocked("PLACE_ARTIFACT_CHECKSUM_MISMATCH");
    this.capture = parseCapture(raw);
    return this.capture;
  }
}
