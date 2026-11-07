/**
 * Backfill / consistency check for Place.geoCell6 / Place.geoCell5.
 *
 *   tsx scripts/data-migrations/backfill-place-geo-cells.ts            # dry run: counts only
 *   tsx scripts/data-migrations/backfill-place-geo-cells.ts --check    # exit 1 when any row is inconsistent
 *   tsx scripts/data-migrations/backfill-place-geo-cells.ts --apply    # write only inconsistent rows
 *
 * Idempotent. Uses the base PrismaClient and writes the cells explicitly, so it
 * never depends on the application-level Place extension. Run against DEV first,
 * after `prisma migrate deploy` has added the columns (release procedure).
 */
import { PrismaClient } from "@prisma/client";
import { geoCellsFor } from "../../src/lib/geo/geoCell";

const prisma = new PrismaClient();
const BATCH = 500;
const APPLY = process.argv.includes("--apply");
const CHECK = process.argv.includes("--check");

async function main() {
  let cursor: string | undefined;
  let scanned = 0;
  let withCoords = 0;
  let inconsistent = 0;
  let written = 0;

  for (;;) {
    const rows = await prisma.place.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, lat: true, lng: true, geoCell6: true, geoCell5: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;

    for (const row of rows) {
      scanned += 1;
      const cells = geoCellsFor(row.lat, row.lng);
      if (cells) withCoords += 1;
      const want6 = cells?.geoCell6 ?? null;
      const want5 = cells?.geoCell5 ?? null;
      if (row.geoCell6 === want6 && row.geoCell5 === want5) continue;
      inconsistent += 1;
      if (APPLY) {
        await prisma.place.update({ where: { id: row.id }, data: { geoCell6: want6, geoCell5: want5 } });
        written += 1;
      }
    }
  }

  console.log(JSON.stringify({ scanned, withCoords, withoutCoords: scanned - withCoords, inconsistent, written, mode: APPLY ? "apply" : CHECK ? "check" : "dry-run" }));
  if (CHECK && inconsistent > 0) process.exitCode = 1;
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
