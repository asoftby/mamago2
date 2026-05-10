import type { Prisma, PrismaClient } from "@prisma/client";
import type { SearchIndexerService } from "@/lib/search/SearchIndexerService";
import { isServerSavePerfEnabled } from "@/server/utils/requestPerf";

type QueryCb = (args: unknown) => Promise<unknown>;

function fireAndForget(p: Promise<void>) {
  void p.catch(() => {});
}

function getSingleId(where: unknown): string | undefined {
  if (!where || typeof where !== "object") return undefined;
  const w = where as { id?: string };
  return typeof w.id === "string" ? w.id : undefined;
}

export function extendPrismaWithSearchIndexing(
  prismaBase: PrismaClient,
  indexer: SearchIndexerService,
): PrismaClient {
  return prismaBase.$extends({
    query: {
      activity: {
        async create({ args, query }: { args: Prisma.ActivityCreateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertActivity(result.id));
          return result;
        },
        async update({ args, query }: { args: Prisma.ActivityUpdateArgs; query: QueryCb }) {
          const started = isServerSavePerfEnabled() ? performance.now() : 0;
          const result = (await query(args)) as { id: string };
          if (isServerSavePerfEnabled()) {
            console.info("[prisma-search-extension]", {
              model: "activity",
              op: "update",
              entityId: result.id,
              queryMs: Math.round(performance.now() - started),
              indexDispatch: "fire-and-forget",
            });
          }
          fireAndForget(indexer.upsertActivity(result.id));
          return result;
        },
        async upsert({ args, query }: { args: Prisma.ActivityUpsertArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertActivity(result.id));
          return result;
        },
        async delete({ args, query }: { args: Prisma.ActivityDeleteArgs; query: QueryCb }) {
          const id = getSingleId(args.where);
          const result = await query(args);
          if (id) fireAndForget(indexer.remove("activity", id));
          return result;
        },
        async updateMany({ args, query }: { args: Prisma.ActivityUpdateManyArgs; query: QueryCb }) {
          const rows = await prismaBase.activity.findMany({
            where: args.where,
            select: { id: true },
          });
          const result = await query(args);
          for (const r of rows) fireAndForget(indexer.upsertActivity(r.id));
          return result;
        },
        async deleteMany({ args, query }: { args: Prisma.ActivityDeleteManyArgs; query: QueryCb }) {
          const rows = await prismaBase.activity.findMany({
            where: args.where,
            select: { id: true },
          });
          const result = await query(args);
          for (const r of rows) fireAndForget(indexer.remove("activity", r.id));
          return result;
        },
      },
      offer: {
        async create({ args, query }: { args: Prisma.OfferCreateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertOffer(result.id));
          return result;
        },
        async update({ args, query }: { args: Prisma.OfferUpdateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertOffer(result.id));
          return result;
        },
        async upsert({ args, query }: { args: Prisma.OfferUpsertArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertOffer(result.id));
          return result;
        },
        async delete({ args, query }: { args: Prisma.OfferDeleteArgs; query: QueryCb }) {
          const id = getSingleId(args.where);
          const result = await query(args);
          if (id) fireAndForget(indexer.remove("offer", id));
          return result;
        },
        async updateMany({ args, query }: { args: Prisma.OfferUpdateManyArgs; query: QueryCb }) {
          const rows = await prismaBase.offer.findMany({ where: args.where, select: { id: true } });
          const result = await query(args);
          for (const r of rows) fireAndForget(indexer.upsertOffer(r.id));
          return result;
        },
        async deleteMany({ args, query }: { args: Prisma.OfferDeleteManyArgs; query: QueryCb }) {
          const rows = await prismaBase.offer.findMany({ where: args.where, select: { id: true } });
          const result = await query(args);
          for (const r of rows) fireAndForget(indexer.remove("offer", r.id));
          return result;
        },
      },
      place: {
        async create({ args, query }: { args: Prisma.PlaceCreateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertPlace(result.id));
          return result;
        },
        async update({ args, query }: { args: Prisma.PlaceUpdateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(
            (async () => {
              await indexer.upsertPlace(result.id);
              await indexer.reindexPlaceDependents(result.id);
            })(),
          );
          return result;
        },
        async upsert({ args, query }: { args: Prisma.PlaceUpsertArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(
            (async () => {
              await indexer.upsertPlace(result.id);
              await indexer.reindexPlaceDependents(result.id);
            })(),
          );
          return result;
        },
        async delete({ args, query }: { args: Prisma.PlaceDeleteArgs; query: QueryCb }) {
          const id = getSingleId(args.where);
          let offerIds: string[] = [];
          if (id) {
            const offers = await prismaBase.offer.findMany({
              where: { placeId: id },
              select: { id: true },
            });
            offerIds = offers.map((o) => o.id);
          }
          const result = await query(args);
          if (id) {
            fireAndForget(indexer.remove("place", id));
            for (const oid of offerIds) fireAndForget(indexer.remove("offer", oid));
          }
          return result;
        },
        async updateMany({ args, query }: { args: Prisma.PlaceUpdateManyArgs; query: QueryCb }) {
          const rows = await prismaBase.place.findMany({ where: args.where, select: { id: true } });
          const result = await query(args);
          for (const r of rows) {
            fireAndForget(
              (async () => {
                await indexer.upsertPlace(r.id);
                await indexer.reindexPlaceDependents(r.id);
              })(),
            );
          }
          return result;
        },
        async deleteMany({ args, query }: { args: Prisma.PlaceDeleteManyArgs; query: QueryCb }) {
          const rows = await prismaBase.place.findMany({ where: args.where, select: { id: true } });
          const placeIds = rows.map((r) => r.id);
          const offers =
            placeIds.length > 0
              ? await prismaBase.offer.findMany({
                  where: { placeId: { in: placeIds } },
                  select: { id: true },
                })
              : [];
          const result = await query(args);
          for (const pid of placeIds) fireAndForget(indexer.remove("place", pid));
          for (const o of offers) fireAndForget(indexer.remove("offer", o.id));
          return result;
        },
      },
      route: {
        async create({ args, query }: { args: Prisma.RouteCreateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertRoute(result.id));
          return result;
        },
        async update({ args, query }: { args: Prisma.RouteUpdateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertRoute(result.id));
          return result;
        },
        async upsert({ args, query }: { args: Prisma.RouteUpsertArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertRoute(result.id));
          return result;
        },
        async delete({ args, query }: { args: Prisma.RouteDeleteArgs; query: QueryCb }) {
          const id = getSingleId(args.where);
          const result = await query(args);
          if (id) fireAndForget(indexer.remove("route", id));
          return result;
        },
        async updateMany({ args, query }: { args: Prisma.RouteUpdateManyArgs; query: QueryCb }) {
          const rows = await prismaBase.route.findMany({ where: args.where, select: { id: true } });
          const result = await query(args);
          for (const r of rows) fireAndForget(indexer.upsertRoute(r.id));
          return result;
        },
        async deleteMany({ args, query }: { args: Prisma.RouteDeleteManyArgs; query: QueryCb }) {
          const rows = await prismaBase.route.findMany({ where: args.where, select: { id: true } });
          const result = await query(args);
          for (const r of rows) fireAndForget(indexer.remove("route", r.id));
          return result;
        },
      },
      article: {
        async create({ args, query }: { args: Prisma.ArticleCreateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertArticle(result.id));
          return result;
        },
        async update({ args, query }: { args: Prisma.ArticleUpdateArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertArticle(result.id));
          return result;
        },
        async upsert({ args, query }: { args: Prisma.ArticleUpsertArgs; query: QueryCb }) {
          const result = (await query(args)) as { id: string };
          fireAndForget(indexer.upsertArticle(result.id));
          return result;
        },
        async delete({ args, query }: { args: Prisma.ArticleDeleteArgs; query: QueryCb }) {
          const id = getSingleId(args.where);
          const result = await query(args);
          if (id) fireAndForget(indexer.remove("article", id));
          return result;
        },
        async updateMany({ args, query }: { args: Prisma.ArticleUpdateManyArgs; query: QueryCb }) {
          const rows = await prismaBase.article.findMany({ where: args.where, select: { id: true } });
          const result = await query(args);
          for (const r of rows) fireAndForget(indexer.upsertArticle(r.id));
          return result;
        },
        async deleteMany({ args, query }: { args: Prisma.ArticleDeleteManyArgs; query: QueryCb }) {
          const rows = await prismaBase.article.findMany({ where: args.where, select: { id: true } });
          const result = await query(args);
          for (const r of rows) fireAndForget(indexer.remove("article", r.id));
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}
