/**
 * One-off: пересчитать segmentKeys для всех UserBehaviorProfile (после деплоя резолвера).
 * Usage: npx tsx scripts/data-migrations/recompute-segments.ts
 */
import { recomputeAllBehaviorSegments } from "../../src/server/services/analytics/SegmentResolverService";

async function main() {
  const n = await recomputeAllBehaviorSegments();
  console.log(`Updated ${n} profiles.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
