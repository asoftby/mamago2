import type { PrismaClient } from "@prisma/client";
import {
  inspectPlaceCoordinateWrite,
  resolvePlaceGeoCellPatch,
} from "@/lib/place/placeGeoCells";

type Args = { data?: Record<string, unknown> | Record<string, unknown>[]; where?: unknown; create?: Record<string, unknown>; update?: Record<string, unknown> };
type QueryCb = (args: unknown) => Promise<unknown>;

/**
 * Keeps Place.geoCell6/geoCell5 consistent with lat/lng on every write that goes
 * through the extended client, so no individual writer has to know about them.
 * A write that omits coordinates is passed through untouched (zero overhead).
 */
export function extendPrismaWithPlaceGeoCells(client: PrismaClient, reader: PrismaClient): PrismaClient {
  async function patched(
    data: Record<string, unknown> | undefined,
    where: unknown,
  ): Promise<Record<string, unknown> | undefined> {
    const { touchesCoordinates, needsCurrentRow } = inspectPlaceCoordinateWrite(data);
    if (!touchesCoordinates) return data;
    let current: { lat: number | null; lng: number | null } | null = null;
    if (needsCurrentRow && where) {
      current = await reader.place.findUnique({
        where: where as never,
        select: { lat: true, lng: true },
      });
    }
    const patch = resolvePlaceGeoCellPatch(data, current);
    return patch ? { ...data, ...patch } : data;
  }

  return client.$extends({
    query: {
      place: {
        async create({ args, query }: { args: Args; query: QueryCb }) {
          return query({ ...args, data: await patched(args.data as Record<string, unknown>, undefined) });
        },
        async update({ args, query }: { args: Args; query: QueryCb }) {
          return query({ ...args, data: await patched(args.data as Record<string, unknown>, args.where) });
        },
        async upsert({ args, query }: { args: Args; query: QueryCb }) {
          return query({
            ...args,
            create: await patched(args.create, undefined),
            update: await patched(args.update, args.where),
          });
        },
        async createMany({ args, query }: { args: Args; query: QueryCb }) {
          const rows = Array.isArray(args.data) ? args.data : args.data ? [args.data] : [];
          const data = await Promise.all(rows.map((row) => patched(row, undefined)));
          return query({ ...args, data });
        },
        async updateMany({ args, query }: { args: Args; query: QueryCb }) {
          // A fixed lat/lng applies to every matched row; a one-sided write cannot be
          // resolved per row here and is left to the backfill --check.
          const { needsCurrentRow } = inspectPlaceCoordinateWrite(args.data as Record<string, unknown>);
          if (needsCurrentRow) return query(args);
          return query({ ...args, data: await patched(args.data as Record<string, unknown>, undefined) });
        },
      },
    },
  }) as unknown as PrismaClient;
}
