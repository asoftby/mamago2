import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeEvent, type NormalizedEventCandidate } from "../../adapters/wordpress-db/normalizeEvent";
import type { WordPressEventBundle } from "../../adapters/wordpress-db/types";

interface EventRecord { sourceRecordKey: string; sourceHash: string; rawPayload: WordPressEventBundle }
interface EventCapture { schemaVersion: number; entity: string; capturedAt: string; records: EventRecord[] }
export interface LoadedFrozenEvent { normalized: NormalizedEventCandidate; ownerUserSourceRecordKey: string; placeSourceRecordKey: string | null }
const fail = (code: string) => new Error(`FAILED:${code}`);

export class FrozenEventSourceRepository {
  private capture: EventCapture | null = null;
  constructor(private readonly root: string, private readonly expectedSha256: string) {
    if (!root.trim()) throw fail("MISSING_PHOENIX_RELEASE_ARTIFACT_ROOT");
  }
  static fromEnvironment(expectedSha256: string, env: NodeJS.ProcessEnv = process.env): FrozenEventSourceRepository {
    return new FrozenEventSourceRepository(env.PHOENIX_RELEASE_ARTIFACT_ROOT ?? "", expectedSha256);
  }
  load(sourceRecordKey: string): LoadedFrozenEvent {
    const matches = this.loadCapture().records.filter((r) => r?.sourceRecordKey === sourceRecordKey);
    if (matches.length === 0) throw fail("EVENT_SOURCE_RECORD_MISSING");
    if (matches.length > 1) throw fail("DUPLICATE_EVENT_SOURCE_RECORD");
    const record = matches[0];
    const payload = record?.rawPayload as WordPressEventBundle | undefined;
    if (!record?.sourceHash || !payload?.post || typeof payload.post.ID !== "number" || typeof payload.post.post_author !== "number" || !payload.postMeta || !Array.isArray(payload.terms)) throw fail("MALFORMED_EVENT_RECORD");
    const normalizedRecord = normalizeEvent(payload);
    if (normalizedRecord.sourceRecordKey !== sourceRecordKey) throw fail("EVENT_SOURCE_KEY_MISMATCH");
    const normalized = normalizedRecord.normalizedPayload as NormalizedEventCandidate;
    return {
      normalized,
      ownerUserSourceRecordKey: `wordpress-db:user:${payload.post.post_author}`,
      placeSourceRecordKey: normalized.venuePlacePostIdRaw ? `wordpress-db:places:${normalized.venuePlacePostIdRaw}` : null,
    };
  }
  private loadCapture(): EventCapture {
    if (this.capture) return this.capture;
    let raw: Buffer;
    try { raw = readFileSync(resolve(this.root, "events/capture.json")); } catch { throw fail("EVENT_ARTIFACT_UNREADABLE"); }
    const sha = createHash("sha256").update(raw).digest("hex");
    if (sha !== this.expectedSha256.toLowerCase()) throw new Error("RELEASE_BLOCKED:EVENT_ARTIFACT_CHECKSUM_MISMATCH");
    let value: Partial<EventCapture>;
    try { value = JSON.parse(raw.toString("utf8")) as Partial<EventCapture>; } catch { throw fail("MALFORMED_EVENT_ARTIFACT"); }
    if (value.schemaVersion !== 1) throw fail("UNSUPPORTED_EVENT_ARTIFACT_VERSION");
    if (value.entity !== "events" || typeof value.capturedAt !== "string" || !Array.isArray(value.records)) throw fail("MALFORMED_EVENT_ARTIFACT");
    this.capture = value as EventCapture;
    return this.capture;
  }
}
