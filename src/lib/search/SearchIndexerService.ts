import type { PrismaClient, SearchEntityType } from "@prisma/client";
import { buildActivityDocument } from "@/lib/search/builders/buildActivityDocument";
import { buildArticleDocument } from "@/lib/search/builders/buildArticleDocument";
import { buildOfferDocument } from "@/lib/search/builders/buildOfferDocument";
import { buildPlaceDocument } from "@/lib/search/builders/buildPlaceDocument";
import { buildRouteDocument } from "@/lib/search/builders/buildRouteDocument";
import type { SearchDocUpsertFields } from "@/lib/search/builders/buildActivityDocument";
import { isServerSavePerfEnabled } from "@/server/utils/requestPerf";
import { SearchIndexQueue } from "@/lib/search/SearchIndexQueue";

const BATCH = 25;

function logIndexerError(context: string, err: unknown) {
  console.error(`[SearchIndexerService] ${context}`, err);
}

export class SearchIndexerService {
  private readonly queue = new SearchIndexQueue();

  constructor(private readonly db: PrismaClient) {}

  private enqueue(
    entityLabel: string,
    entityId: string,
    operation: () => Promise<void>,
    strict: boolean,
  ): Promise<void> {
    const queued = this.queue.enqueue(`${entityLabel}:${entityId}`, operation);
    if (strict) return queued;
    return queued.catch((error) => {
      logIndexerError(`upsert ${entityLabel} ${entityId}`, error);
    });
  }

  private async upsertDoc(doc: SearchDocUpsertFields | null, entityLabel: string, entityId: string) {
    const started = isServerSavePerfEnabled() ? performance.now() : 0;
    if (!doc) {
      await this.db.searchDocument.deleteMany({
        where: { entityType: entityLabel as SearchEntityType, entityId },
      });
      if (isServerSavePerfEnabled()) {
        console.info("[search-index-upsert]", {
          entityLabel,
          entityId,
          action: "delete-stale",
          durationMs: Math.round(performance.now() - started),
        });
      }
      return;
    }

    const { entityType, entityId: eid, ...rest } = doc;
    await this.db.searchDocument.upsert({
      where: {
        entityType_entityId: {
          entityType,
          entityId: eid,
        },
      },
      create: { entityType, entityId: eid, ...rest },
      update: rest,
    });
    if (isServerSavePerfEnabled()) {
      console.info("[search-index-upsert]", {
        entityLabel,
        entityId,
        action: "upsert",
        durationMs: Math.round(performance.now() - started),
      });
    }
  }

  private async upsertActivityNow(activityId: string): Promise<void> {
    const started = isServerSavePerfEnabled() ? performance.now() : 0;
    const buildStarted = isServerSavePerfEnabled() ? performance.now() : 0;
    const doc = await buildActivityDocument(this.db, activityId);
    const buildMs = isServerSavePerfEnabled() ? Math.round(performance.now() - buildStarted) : 0;
    const writeStarted = isServerSavePerfEnabled() ? performance.now() : 0;
    await this.upsertDoc(doc, "activity", activityId);
    const writeMs = isServerSavePerfEnabled() ? Math.round(performance.now() - writeStarted) : 0;
    if (isServerSavePerfEnabled()) {
      console.info("[search-index-activity]", {
        activityId,
        buildMs,
        writeMs,
        totalMs: Math.round(performance.now() - started),
      });
    }
  }

  async upsertActivity(activityId: string): Promise<void> {
    return this.enqueue("activity", activityId, () => this.upsertActivityNow(activityId), false);
  }

  async upsertActivityStrict(activityId: string): Promise<void> {
    return this.enqueue("activity", activityId, () => this.upsertActivityNow(activityId), true);
  }

  async upsertOffer(offerId: string): Promise<void> {
    return this.enqueue("offer", offerId, async () => {
      const doc = await buildOfferDocument(this.db, offerId);
      await this.upsertDoc(doc, "offer", offerId);
    }, false);
  }

  async upsertOfferStrict(offerId: string): Promise<void> {
    return this.enqueue("offer", offerId, async () => {
      const doc = await buildOfferDocument(this.db, offerId);
      await this.upsertDoc(doc, "offer", offerId);
    }, true);
  }

  async upsertPlace(placeId: string): Promise<void> {
    return this.enqueue("place", placeId, async () => {
      const doc = await buildPlaceDocument(this.db, placeId);
      await this.upsertDoc(doc, "place", placeId);
    }, false);
  }

  async upsertPlaceStrict(placeId: string): Promise<void> {
    return this.enqueue("place", placeId, async () => {
      const doc = await buildPlaceDocument(this.db, placeId);
      await this.upsertDoc(doc, "place", placeId);
    }, true);
  }

  async upsertRoute(routeId: string): Promise<void> {
    try {
      const doc = await buildRouteDocument(this.db, routeId);
      await this.upsertDoc(doc, "route", routeId);
    } catch (e) {
      logIndexerError(`upsertRoute ${routeId}`, e);
    }
  }

  async upsertArticle(articleId: string): Promise<void> {
    try {
      const doc = await buildArticleDocument(this.db, articleId);
      await this.upsertDoc(doc, "article", articleId);
    } catch (e) {
      logIndexerError(`upsertArticle ${articleId}`, e);
    }
  }

  async remove(entityType: string, entityId: string): Promise<void> {
    try {
      await this.db.searchDocument.deleteMany({
        where: {
          entityType: entityType as SearchEntityType,
          entityId,
        },
      });
    } catch (e) {
      logIndexerError(`remove ${entityType} ${entityId}`, e);
    }
  }

  /**
   * Place title/city feed into linked Activity/Offer searchText — reindex dependents after place writes.
   */
  async reindexPlaceDependents(placeId: string): Promise<void> {
    try {
      const [acts, offs] = await Promise.all([
        this.db.activity.findMany({ where: { placeId }, select: { id: true } }),
        this.db.offer.findMany({ where: { placeId }, select: { id: true } }),
      ]);
      for (const a of acts) await this.upsertActivity(a.id);
      for (const o of offs) await this.upsertOffer(o.id);
    } catch (e) {
      logIndexerError(`reindexPlaceDependents ${placeId}`, e);
    }
  }

  async reindexAll(): Promise<void> {
    const [activities, offers, places, routes, articles] = await Promise.all([
      this.db.activity.findMany({ select: { id: true } }),
      this.db.offer.findMany({ select: { id: true } }),
      this.db.place.findMany({ select: { id: true } }),
      this.db.route.findMany({ select: { id: true } }),
      this.db.article.findMany({ select: { id: true } }),
    ]);

    const runBatch = async (ids: string[], fn: (id: string) => Promise<void>) => {
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        await Promise.all(chunk.map((id) => fn(id)));
      }
    };

    await runBatch(
      activities.map((a) => a.id),
      (id) => this.upsertActivity(id),
    );
    await runBatch(
      offers.map((o) => o.id),
      (id) => this.upsertOffer(id),
    );
    await runBatch(
      places.map((p) => p.id),
      (id) => this.upsertPlace(id),
    );
    await runBatch(
      routes.map((r) => r.id),
      (id) => this.upsertRoute(id),
    );
    await runBatch(
      articles.map((a) => a.id),
      (id) => this.upsertArticle(id),
    );
  }
}
