/**
 * Нормализация постов Telegram-канала (LLM) на общем мультимодальном модуле.
 *
 *   1. Предфильтр без модели, только бесспорное: опрос, пост без текста и картинок.
 *   2. Бюджет вызовов модели на запуск источника (`aiCallBudgetPerRun`).
 *      Исчерпан: запись остаётся PENDING и добирается следующим запуском.
 *   3. Один вызов модели на пост: текст и все фото (до 10), быстрая модель,
 *      повтор, сильная модель.
 *   4. Тип поста: EVENT, FESTIVAL, DIGEST (дочерние записи), NOT_EVENT.
 *   5. Автоотсев (past_event, incomplete, out_of_territory) закрывает задачу ревью.
 *
 * Ничего не публикуется и не сливается: запись только попадает в очередь ревью.
 * Журнал: id, коды, модель, токены. Тексты постов и ответы модели не логируются.
 */

import type { ImportRun, ImportSource, ImportedRecord, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  createOpenRouterClient,
  readCaptureModelConfig,
  type CaptureModelConfig,
  type OpenRouterClient,
  type OpenRouterResponseFormat,
} from "@/lib/ai/openrouterClient";
import { detectEventCategory, type CategoryDetectionResult } from "@/lib/ai/detectEventCategory";
import {
  createExtractionCall,
  createWebImageSource,
  imageToDataUrl,
  type ExtractionUsage,
  type ImageLoadResult,
} from "@/server/ai/extraction";
import { isTelegramImageHost, TELEGRAM_CHANNEL_PARSER_KEY } from "../parsers/telegram-channel-constants";
import {
  buildTelegramPostUserParts,
  dropChannelSelfLinks,
  TELEGRAM_POST_SYSTEM_PROMPT,
} from "../normalizers/telegram-post.prompt";
import {
  parseTelegramPostExtraction,
  telegramPostJsonSchema,
  type TelegramPostExtraction,
} from "../normalizers/telegram-post.schema";
import {
  diffKeyFields,
  mapTelegramExtraction,
  skippedFlags,
  type MappedTelegramEvent,
  type TelegramPostContext,
  type TelegramQualityFlags,
  type TelegramSkipReason,
} from "../normalizers/telegram-post.mapper";
import type { NormalizedEventImport } from "../types";
import { scoreEventImport } from "./import-quality.service";
import { ensureImportReviewTaskExists } from "./import-review-task.service";

const MAX_IMAGES_PER_POST = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type TelegramNormalizeOutcome =
  | { status: "normalized"; events: number }
  | { status: "skipped"; reason: TelegramSkipReason }
  | { status: "postponed"; reason: "budget" | "model_not_configured" }
  | { status: "failed"; code: string };

export interface TelegramNormalizerDeps {
  openrouter: Pick<OpenRouterClient, "chat">;
  models: () => CaptureModelConfig;
  loadImage: (url: string) => Promise<ImageLoadResult>;
  detectCategory: (input: Parameters<typeof detectEventCategory>[0]) => Promise<CategoryDetectionResult | null>;
  now: () => Date;
}

function defaultDeps(): TelegramNormalizerDeps {
  const images = createWebImageSource({ maxBytes: MAX_IMAGE_BYTES, isAllowedHost: isTelegramImageHost });
  return {
    openrouter: createOpenRouterClient(),
    models: () => readCaptureModelConfig(),
    loadImage: (url) => images.load(url),
    detectCategory: detectEventCategory,
    now: () => new Date(),
  };
}

/** `<канал>/<id>` или `<канал>/<id>#n` -> `<канал>`. */
function channelOf(externalId: string): string {
  return externalId.split("/")[0];
}

type RawPost = {
  text: string;
  links: { text: string; href: string }[];
  hashtags: string[];
  postedAt: string | null;
  flags: { poll?: boolean };
  images: { url: string; sha256: string | null }[];
};

function readRawPost(payload: unknown): RawPost {
  const p = (payload ?? {}) as Record<string, unknown>;
  const arr = <T>(value: unknown, guard: (v: unknown) => v is T): T[] => (Array.isArray(value) ? value.filter(guard) : []);
  return {
    text: typeof p.text === "string" ? p.text : "",
    links: arr(p.links, (v): v is { text: string; href: string } => typeof (v as { href?: unknown })?.href === "string"),
    hashtags: arr(p.hashtags, (v): v is string => typeof v === "string"),
    postedAt: typeof p.postedAt === "string" ? p.postedAt : null,
    flags: (p.flags ?? {}) as { poll?: boolean },
    images: arr(p.images, (v): v is { url: string; sha256: string | null } => typeof (v as { url?: unknown })?.url === "string"),
  };
}

/** Бюджет исчерпан посреди записи: запись откладывается целиком. */
class BudgetExhausted extends Error {
  constructor() {
    super("AI call budget exhausted");
    this.name = "BudgetExhausted";
  }
}

/**
 * Бюджет вызовов модели на запуск. Проверяется перед КАЖДЫМ вызовом
 * (извлечение, повтор, сильная модель, категория), а не только перед записью.
 * `limit === null`: запуска нет, ограничения нет.
 */
function createCallBudget(limit: number | null, alreadyUsed: number) {
  let spent = 0;
  let reported = 0;
  return {
    canSpend: () => limit === null || alreadyUsed + spent < limit,
    take() {
      if (limit !== null && alreadyUsed + spent >= limit) throw new BudgetExhausted();
      spent++;
    },
    /** Сколько вызовов ещё не записано в счётчики запуска. */
    unreported() {
      const delta = spent - reported;
      reported = spent;
      return delta;
    },
  };
}
type CallBudget = ReturnType<typeof createCallBudget>;

const NO_USAGE: ExtractionUsage = { tokensIn: null, tokensOut: null, model: null };

export function createTelegramPostNormalizer(overrides: Partial<TelegramNormalizerDeps> = {}) {
  const deps = { ...defaultDeps(), ...overrides } as TelegramNormalizerDeps;

  // ── Review task helpers ────────────────────────────────────────────────────
  async function closeRecord(record: Pick<ImportedRecord, "id" | "publishedActivityId">, reason: TelegramSkipReason | "stale") {
    // Опубликованное или уже разобранное не закрываем: решение редактора главнее.
    if (record.publishedActivityId) return;
    await prisma.importReviewTask.updateMany({
      where: { importedRecordId: record.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
      data: { status: "CANCELLED", notes: `auto: ${reason}` },
    });
    await prisma.importedRecord.updateMany({
      where: { id: record.id, reviewStatus: { in: ["PENDING", "IN_REVIEW"] } },
      data: { reviewStatus: "SKIPPED" },
    });
  }

  async function reopenReviewTask(recordId: string) {
    await prisma.importReviewTask.updateMany({
      where: { importedRecordId: recordId, status: { in: ["COMPLETED", "CANCELLED"] } },
      data: { status: "PENDING", reviewedAt: null },
    });
  }

  /**
   * Автоотсеянная запись снова стала валидной после правки поста: возвращаем её
   * в очередь. Только если задачу закрыла автоматика (`auto:`), а не редактор.
   */
  async function reopenIfAutoClosed(recordId: string) {
    const task = await prisma.importReviewTask.findUnique({
      where: { importedRecordId: recordId },
      select: { status: true, notes: true },
    });
    if (!task || task.status !== "CANCELLED" || !task.notes?.startsWith("auto:")) return;
    await prisma.importReviewTask.update({
      where: { importedRecordId: recordId },
      data: { status: "PENDING", notes: null, reviewedAt: null },
    });
    await prisma.importedRecord.updateMany({
      where: { id: recordId, reviewStatus: "SKIPPED" },
      data: { reviewStatus: "PENDING" },
    });
  }

  /**
   * Пост, по которому событие уже опубликовано, правкой ушёл в автоотсев
   * (прошла дата, другой город, больше не событие). Событие на сайте остаётся
   * прежним, поэтому редактора нужно предупредить: данные не затираем, ставим
   * `sourceChanged` и переоткрываем задачу.
   */
  async function flagPublishedChange(
    record: ImportedRecord,
    reason: TelegramSkipReason,
    previous: NormalizedEventImport | null,
    normalized?: NormalizedEventImport,
  ) {
    const fields = [...(normalized ? diffKeyFields(previous, normalized) : []), `skip:${reason}`];
    await prisma.importedRecord.update({
      where: { id: record.id },
      data: {
        normalizeStatus: "SUCCESS",
        matchStatus: "SKIPPED",
        errorMessage: null,
        qualityFlags: {
          ...((record.qualityFlags as object | null) ?? {}),
          sourceChanged: { fields, detectedAt: deps.now().toISOString() },
        } as Prisma.InputJsonValue,
      },
    });
    await reopenReviewTask(record.id);
  }

  async function skipRecord(
    record: ImportedRecord,
    reason: TelegramSkipReason,
    flags: TelegramQualityFlags,
    previous: NormalizedEventImport | null,
    normalized?: NormalizedEventImport,
  ) {
    if (record.publishedActivityId) return flagPublishedChange(record, reason, previous, normalized);
    return markSkipped(record, reason, flags, normalized);
  }

  async function markSkipped(
    record: ImportedRecord,
    reason: TelegramSkipReason,
    flags: TelegramQualityFlags,
    normalized?: NormalizedEventImport,
  ) {
    await prisma.importedRecord.update({
      where: { id: record.id },
      data: {
        normalizeStatus: "SKIPPED",
        matchStatus: "SKIPPED",
        errorMessage: null,
        qualityFlags: flags as unknown as Prisma.InputJsonValue,
        ...(normalized ? { normalizedData: normalized as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    await closeRecord(record, reason);
  }

  async function cancelStaleChildren(parentId: string, keepExternalIds: string[]) {
    const children = await prisma.importedRecord.findMany({
      where: { parentRecordId: parentId, externalId: { notIn: keepExternalIds } },
      select: { id: true, publishedActivityId: true },
    });
    for (const child of children) {
      await prisma.importedRecord.update({
        where: { id: child.id },
        data: {
          normalizeStatus: "SKIPPED",
          matchStatus: "SKIPPED",
          qualityFlags: skippedFlags("digest_split", "DIGEST", { sourceChanged: null }) as unknown as Prisma.InputJsonValue,
        },
      });
      await closeRecord(child, "stale");
    }
  }

  // ── Run counters ───────────────────────────────────────────────────────────
  async function addRunUsage(runId: string | null, calls: number, usage: ExtractionUsage) {
    if (!runId || (calls === 0 && usage.tokensIn === null && usage.tokensOut === null)) return;
    await prisma.importRun.update({
      where: { id: runId },
      data: {
        aiCalls: { increment: calls },
        aiTokensIn: { increment: usage.tokensIn ?? 0 },
        aiTokensOut: { increment: usage.tokensOut ?? 0 },
      },
      select: { id: true },
    });
  }

  // ── One record ─────────────────────────────────────────────────────────────
  async function normalizeRecord(
    record: ImportedRecord,
    source: ImportSource,
    runId: string | null,
  ): Promise<TelegramNormalizeOutcome> {
    const raw = readRawPost(record.rawPayload);
    const externalId = record.externalId ?? record.id;

    // 1. Предфильтр: только бесспорные случаи.
    if (raw.flags.poll) {
      await markSkipped(record, "poll", skippedFlags("poll", null));
      return { status: "skipped", reason: "poll" };
    }
    if (!raw.text.trim() && raw.images.length === 0) {
      await markSkipped(record, "empty_post", skippedFlags("empty_post", null));
      return { status: "skipped", reason: "empty_post" };
    }

    // 2. Бюджет запуска.
    const models = deps.models();
    if (!models.fast) return { status: "postponed", reason: "model_not_configured" };
    let run: Pick<ImportRun, "aiCalls"> | null = null;
    if (runId) run = await prisma.importRun.findUnique({ where: { id: runId }, select: { aiCalls: true } });
    const budget = createCallBudget(run ? source.aiCallBudgetPerRun : null, run?.aiCalls ?? 0);
    if (!budget.canSpend()) return { status: "postponed", reason: "budget" };

    // 3. Картинки (память, на диск не пишем).
    const imageDataUrls: string[] = [];
    const loadedIndexes: number[] = [];
    for (const [i, image] of raw.images.slice(0, MAX_IMAGES_PER_POST).entries()) {
      const loaded = await deps.loadImage(image.url);
      if (loaded.ok) {
        imageDataUrls.push(imageToDataUrl(loaded.value));
        loadedIndexes.push(i);
      }
    }
    if (!raw.text.trim() && imageDataUrls.length === 0) {
      await prisma.importedRecord.update({
        where: { id: record.id },
        data: { normalizeStatus: "FAILED", errorMessage: "IMAGES_UNAVAILABLE" },
      });
      return { status: "failed", code: "IMAGES_UNAVAILABLE" };
    }

    // 4. Модель. Каждый HTTP-вызов считаем в бюджет.
    const usage: ExtractionUsage = { tokensIn: null, tokensOut: null, model: null };
    const countingClient: Pick<OpenRouterClient, "chat"> = {
      chat: (input) => {
        budget.take(); // перед каждым вызовом, включая повтор и сильную модель
        return deps.openrouter.chat(input);
      },
    };
    const responseFormat: OpenRouterResponseFormat =
      models.responseFormat === "json_schema"
        ? { type: "json_schema", name: "telegram_post", schema: telegramPostJsonSchema() }
        : { type: "json_object" };
    const territory = source.territoryId
      ? await prisma.territory.findUnique({ where: { id: source.territoryId }, select: { type: true, name: true } })
      : null;
    const territoryCityName = territory?.type === "CITY" ? territory.name : null;

    const call = createExtractionCall<TelegramPostExtraction>({
      openrouter: countingClient,
      systemPrompt: TELEGRAM_POST_SYSTEM_PROMPT,
      userParts: buildTelegramPostUserParts({
        postedAt: raw.postedAt,
        text: raw.text,
        links: dropChannelSelfLinks(raw.links, channelOf(externalId)),
        hashtags: raw.hashtags,
        cityHint: territoryCityName,
        imageDataUrls,
      }),
      responseFormat,
      parse: (content) => {
        const parsed = parseTelegramPostExtraction(content);
        return parsed.ok ? { ok: true, value: parsed.value } : { ok: false };
      },
      usage,
    });
    let outcome: Awaited<ReturnType<typeof call.runWithRetry>>;
    try {
      outcome = await call.runWithRetry({ fast: models.fast, strong: models.strong });
    } catch (error) {
      if (!(error instanceof BudgetExhausted)) throw error;
      // Бюджет кончился на повторе или эскалации: уже сделанные вызовы учтены,
      // запись остаётся PENDING и разбирается заново следующим запуском.
      await addRunUsage(runId, budget.unreported(), usage);
      console.log(`[telegram-post-normalizer] recordId=${record.id} postponed=budget`);
      return { status: "postponed", reason: "budget" };
    }
    const modelCalls = budget.unreported();
    await addRunUsage(runId, modelCalls, usage);
    console.log(
      `[telegram-post-normalizer] recordId=${record.id} calls=${modelCalls} model=${usage.model ?? "-"} ` +
        `tokensIn=${usage.tokensIn ?? "-"} tokensOut=${usage.tokensOut ?? "-"} ok=${outcome.ok}`,
    );

    if (!outcome.ok) {
      if (outcome.reason === "NOT_CONFIGURED") return { status: "postponed", reason: "model_not_configured" };
      const code = outcome.reason === "INFRA" ? "AI_UNAVAILABLE" : "AI_INVALID_OUTPUT";
      await prisma.importedRecord.update({
        where: { id: record.id },
        data: { normalizeStatus: "FAILED", errorMessage: code },
      });
      return { status: "failed", code };
    }

    // 5. Маппинг. Номера картинок в ответе модели относятся к загруженным.
    const loadedImages = loadedIndexes.map((i) => raw.images[i]);
    const ctx: TelegramPostContext = {
      sourceSlug: source.slug,
      externalId,
      sourceUrl: record.sourceUrl ?? "",
      postedAt: raw.postedAt,
      text: raw.text,
      links: raw.links,
      images: loadedImages,
      territoryCityName,
      now: deps.now(),
    };
    const mapped = mapTelegramExtraction(outcome.value, ctx);
    const previous = record.normalizedData as NormalizedEventImport | null;

    if (mapped.postKind === "NOT_EVENT") {
      await cancelStaleChildren(record.id, []);
      await skipRecord(record, "not_event", skippedFlags("not_event", "NOT_EVENT"), previous);
      return { status: "skipped", reason: "not_event" };
    }

    if (mapped.postKind === "DIGEST") {
      const kept: string[] = [];
      let created = 0;
      for (const event of mapped.events) {
        if (event.skipReason) continue;
        kept.push(event.externalId);
        await upsertDigestChild(record, source, runId, raw, event, budget);
        created++;
      }
      await cancelStaleChildren(record.id, kept);
      await markSkipped(record, "digest_split", skippedFlags("digest_split", "DIGEST"));
      await addRunUsage(runId, budget.unreported(), NO_USAGE);
      return { status: "normalized", events: created };
    }

    // EVENT / FESTIVAL: одна запись.
    await cancelStaleChildren(record.id, []);
    const event = mapped.events[0];
    if (event.skipReason) {
      await skipRecord(record, event.skipReason, event.qualityFlags, previous, event.normalized);
      return { status: "skipped", reason: event.skipReason };
    }
    await enrichCategory(event, budget);
    const { score } = scoreEventImport(event.normalized);

    const changedFields = record.publishedActivityId ? diffKeyFields(previous, event.normalized) : [];
    if (changedFields.length > 0) {
      event.qualityFlags.sourceChanged = { fields: changedFields, detectedAt: deps.now().toISOString() };
    }
    await prisma.importedRecord.update({
      where: { id: record.id },
      data: {
        normalizedData: event.normalized as unknown as Prisma.InputJsonValue,
        normalizeStatus: "SUCCESS",
        qualityScore: score,
        qualityFlags: event.qualityFlags as unknown as Prisma.InputJsonValue,
        errorMessage: null,
        matchStatus: "PENDING",
        // Запись, добранная из прошлого запуска, переезжает в текущий, чтобы её увидел матчинг.
        ...(runId ? { runId } : {}),
      },
    });
    if (changedFields.length > 0) await reopenReviewTask(record.id);
    // Пост был автоотсеян, правка сделала его валидным: возвращаем в очередь.
    await reopenIfAutoClosed(record.id);
    await addRunUsage(runId, budget.unreported(), NO_USAGE);
    return { status: "normalized", events: 1 };
  }

  async function enrichCategory(event: MappedTelegramEvent, budget: CallBudget) {
    const n = event.normalized;
    if (!n.title) return;
    // Категория необязательна: без бюджета вызов пропускаем, редактор выберет сам.
    if (!budget.canSpend()) return;
    budget.take();
    try {
      const category = await deps.detectCategory({
        title: n.title,
        description: n.description,
        shortDescription: n.shortDescCandidate,
        venueName: n.venueName,
        addressText: n.addressText,
        categoryCandidates: n.categoryCandidates,
        ageText: n.ageText,
        priceText: n.priceText,
        scheduleText: n.scheduleText,
        organizerName: n.organizerName,
      });
      if (!category) return;
      n.aiDetectedCategoryId = category.categoryId;
      n.aiDetectedCategorySlug = category.categorySlug;
      n.aiDetectedCategoryPath = category.categoryPath;
      n.aiDetectedCategoryConfidence = category.confidence;
      if (!n.categoryCandidates.includes(category.categoryNameRu)) {
        n.categoryCandidates = [category.categoryNameRu, ...n.categoryCandidates];
      }
    } catch {
      // Категория не критична: редактор выберет сам.
    }
  }

  async function upsertDigestChild(
    parent: ImportedRecord,
    source: ImportSource,
    runId: string | null,
    raw: RawPost,
    event: MappedTelegramEvent,
    budget: CallBudget,
  ) {
    const childRunId = runId;
    await enrichCategory(event, budget);
    const { score } = scoreEventImport(event.normalized);
    const existing = await prisma.importedRecord.findUnique({
      where: { sourceId_externalId: { sourceId: source.id, externalId: event.externalId } },
    });
    const base = {
      sourceUrl: parent.sourceUrl,
      canonicalSourceUrl: parent.canonicalSourceUrl ?? parent.sourceUrl,
      rawPayload: {
        ...(parent.rawPayload as Record<string, unknown>),
        digest: { parentExternalId: parent.externalId, index: event.index },
      } as Prisma.InputJsonValue,
      rawText: raw.text,
      contentHash: `${parent.contentHash ?? ""}#${event.index}`,
      sourceUpdatedAt: parent.sourceUpdatedAt,
      normalizedData: event.normalized as unknown as Prisma.InputJsonValue,
      qualityScore: score,
    };

    if (!existing) {
      const created = await prisma.importedRecord.create({
        data: {
          ...base,
          source: { connect: { id: source.id } },
          ...(childRunId ? { run: { connect: { id: childRunId } } } : {}),
          externalId: event.externalId,
          entityTypeHint: "EVENT",
          parentRecordId: parent.id,
          parseStatus: "SUCCESS",
          normalizeStatus: "SUCCESS",
          qualityFlags: event.qualityFlags as unknown as Prisma.InputJsonValue,
          fetchedAt: new Date(),
        },
        select: { id: true },
      });
      await ensureImportReviewTaskExists(created.id);
      return;
    }

    const decided = existing.publishedActivityId !== null || ["APPROVED", "REJECTED"].includes(existing.reviewStatus);
    if (decided) {
      // Решение редактора не затираем: только помечаем изменение источника.
      const fields = diffKeyFields(existing.normalizedData as NormalizedEventImport | null, event.normalized);
      if (fields.length > 0) {
        await prisma.importedRecord.update({
          where: { id: existing.id },
          data: {
            qualityFlags: {
              ...(existing.qualityFlags as object | null),
              sourceChanged: { fields, detectedAt: deps.now().toISOString() },
            } as Prisma.InputJsonValue,
          },
        });
        await reopenReviewTask(existing.id);
      }
      return;
    }

    await prisma.importedRecord.update({
      where: { id: existing.id },
      data: {
        ...base,
        parentRecordId: parent.id,
        normalizeStatus: "SUCCESS",
        matchStatus: "PENDING",
        qualityFlags: event.qualityFlags as unknown as Prisma.InputJsonValue,
        errorMessage: null,
        ...(childRunId ? { runId: childRunId } : {}),
      },
    });
    await ensureImportReviewTaskExists(existing.id);
    // Ребёнок был автоотсеян (например, без даты), правка поста сделала его валидным.
    await reopenIfAutoClosed(existing.id);
  }

  return {
    /** Нормализовать одну запись канала. */
    async normalize(recordId: string, options: { runId?: string | null } = {}): Promise<TelegramNormalizeOutcome> {
      const record = await prisma.importedRecord.findUnique({ where: { id: recordId } });
      if (!record) return { status: "failed", code: "RECORD_NOT_FOUND" };
      const source = await prisma.importSource.findUnique({ where: { id: record.sourceId } });
      if (!source) return { status: "failed", code: "SOURCE_NOT_FOUND" };
      return normalizeRecord(record, source, options.runId ?? record.runId);
    },
  };
}

export type TelegramPostNormalizer = ReturnType<typeof createTelegramPostNormalizer>;

let defaultNormalizer: TelegramPostNormalizer | null = null;
export function getTelegramPostNormalizer(): TelegramPostNormalizer {
  defaultNormalizer ??= createTelegramPostNormalizer();
  return defaultNormalizer;
}

export { TELEGRAM_CHANNEL_PARSER_KEY };
