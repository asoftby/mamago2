import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeRoute, type NormalizedRouteCandidate } from "../../adapters/wordpress-db/normalizeRoute";
import type { WordPressRouteBundle } from "../../adapters/wordpress-db/types";
interface RecordRow { sourceRecordKey: string; sourceHash: string; rawPayload: WordPressRouteBundle }
interface Capture { schemaVersion: number; entity: string; capturedAt: string; records: RecordRow[] }
const failed = (code: string) => new Error(`FAILED:${code}`);
export interface LoadedFrozenRoute { normalized: NormalizedRouteCandidate; sourceHash: string; warnings: readonly { code: string }[] }
export class FrozenRouteSourceRepository {
  private capture: Capture | null = null;
  constructor(private readonly root: string, private readonly expectedSha: string) { if (!root.trim()) throw failed("MISSING_PHOENIX_RELEASE_ARTIFACT_ROOT"); }
  static fromEnvironment(sha: string, env: NodeJS.ProcessEnv = process.env) { return new FrozenRouteSourceRepository(env.PHOENIX_RELEASE_ARTIFACT_ROOT ?? "", sha); }
  load(key: string): LoadedFrozenRoute {
    const matches = this.getCapture().records.filter((row) => row?.sourceRecordKey === key);
    if (!matches.length) throw failed("ROUTE_SOURCE_RECORD_MISSING"); if (matches.length > 1) throw failed("DUPLICATE_ROUTE_SOURCE_RECORD");
    const row = matches[0]; const payload = row?.rawPayload;
    if (!row?.sourceHash || !payload?.post || typeof payload.post.ID !== "number" || typeof payload.post.post_title !== "string" || !payload.post.post_title.trim() || typeof payload.post.post_name !== "string" || !payload.post.post_name.trim() || !payload.postMeta || !Array.isArray(payload.terms)) throw failed("MALFORMED_ROUTE_RECORD");
    const result = normalizeRoute(payload); if (result.sourceRecordKey !== key) throw failed("ROUTE_SOURCE_KEY_MISMATCH");
    const normalized = result.normalizedPayload as NormalizedRouteCandidate;
    if (normalized.stops.length === 0) throw failed("MALFORMED_ROUTE_RECORD");
    return { normalized, sourceHash: row.sourceHash, warnings: result.warnings ?? [] };
  }
  private getCapture(): Capture {
    if (this.capture) return this.capture; let raw: Buffer;
    try { raw = readFileSync(resolve(this.root, "routes/capture.json")); } catch { throw failed("ROUTE_ARTIFACT_UNREADABLE"); }
    if (createHash("sha256").update(raw).digest("hex") !== this.expectedSha.toLowerCase()) throw new Error("RELEASE_BLOCKED:ROUTE_ARTIFACT_CHECKSUM_MISMATCH");
    let value: Partial<Capture>; try { value = JSON.parse(raw.toString("utf8")) as Partial<Capture>; } catch { throw failed("MALFORMED_ROUTE_ARTIFACT"); }
    if (value.schemaVersion !== 1) throw new Error("RELEASE_BLOCKED:UNSUPPORTED_ROUTE_ARTIFACT_VERSION");
    if (value.entity !== "routes" || typeof value.capturedAt !== "string" || !Array.isArray(value.records)) throw failed("MALFORMED_ROUTE_ARTIFACT");
    this.capture = value as Capture; return this.capture;
  }
}
