import type {
  FindLineageBySourceRecordKeysInput,
  GetLineageActionForRecordInput,
  LineageAction,
  LineageMap,
  MigrationLedgerPrismaClient,
  MigrationLineage,
  MigrationRun,
  MigrationSource,
} from "./types";

/**
 * Read-only lookups against the Phoenix migration ledger tables
 * (`MigrationSource`/`MigrationRun`/`MigrationLineage`, already created by
 * migration `20260704020116_add_migration_engine_tables`). No
 * INSERT/UPDATE/DELETE/UPSERT anywhere in this file — that's a later PR
 * (Commit Mode). The Prisma client is injected via the constructor, never
 * imported as the app singleton, so this stays fully testable without a
 * live database.
 */
export class MigrationLedgerRepository {
  constructor(private readonly prisma: MigrationLedgerPrismaClient) {}

  async findSourceByAdapter(
    adapterKey: string,
    sourceNamespace: string,
  ): Promise<MigrationSource | null> {
    return this.prisma.migrationSource.findUnique({
      where: { adapterKey_sourceNamespace: { adapterKey, sourceNamespace } },
    });
  }

  async findLatestRun(sourceId: string): Promise<MigrationRun | null> {
    return this.prisma.migrationRun.findFirst({
      where: { sourceId },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
  }

  async findLineageBySourceRecordKeys(
    input: FindLineageBySourceRecordKeysInput,
  ): Promise<LineageMap> {
    if (input.keys.length === 0) {
      return new Map();
    }

    const source = await this.findSourceByAdapter(input.adapterKey, input.sourceNamespace);
    if (!source) {
      return new Map();
    }

    const rows = await this.prisma.migrationLineage.findMany({
      where: {
        sourceId: source.id,
        sourceRecordKey: { in: [...input.keys] },
        isActive: true,
        ...(input.targetType !== undefined ? { targetType: input.targetType } : {}),
        // `targetRole` is a non-nullable column (default "primary"); treat an
        // explicit `null` the same as `undefined` — "don't filter" — since a
        // literal `where: { targetRole: null }` could never match any row.
        ...(typeof input.targetRole === "string" ? { targetRole: input.targetRole } : {}),
      },
    });

    const map = new Map<string, MigrationLineage[]>();
    for (const row of rows) {
      const existing = map.get(row.sourceRecordKey);
      if (existing) {
        existing.push(row);
      } else {
        map.set(row.sourceRecordKey, [row]);
      }
    }
    return map;
  }
}

/**
 * Pure decision helper — no Prisma access. Given the lineage rows already
 * looked up for one source record (if any) plus the target type this
 * normalizer produced and the freshly-computed sourceHash, decides whether
 * this would be a first-time CREATE, an UPDATE (content changed since last
 * import), or a no-op (content identical to what's already imported).
 */
export function getLineageActionForRecord(input: GetLineageActionForRecordInput): LineageAction {
  const matching = (input.lineage ?? []).find((row) => row.targetType === input.targetType);
  if (!matching) {
    return "CREATE";
  }
  if (matching.lastSourceHash === input.sourceHash) {
    return "SKIP_UNCHANGED";
  }
  return "UPDATE";
}
