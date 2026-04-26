
import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  NormalizedPlaceImport,
  NormalizedEventImport,
  PlaceMatchCandidate,
  EventMatchCandidate,
} from "@/server/modules/import/types";
import { ImportEventMediaIngest } from "./_components/ImportEventMediaIngest";
import { ReviewDetailWorkflow } from "./_components/ReviewDetailWorkflow";
import { reconcileImportedRecordLinks } from "@/server/modules/import/services/import-link-reconciliation.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Data fetching ─────────────────────────────────────────────────────────────

/** Поля ImportedRecord + source, реально читаемые на этой странице (без лишних скаляров и без run). */
const importedRecordForReviewDetailSelect = {
  id: true,
  rawPayload: true,
  sourceUrl: true,
  externalId: true,
  fetchedAt: true,
  parseStatus: true,
  normalizeStatus: true,
  rawText: true,
  entityTypeHint: true,
  matchCandidates: true,
  normalizedData: true,
  reviewStatus: true,
  publishedPlaceId: true,
  publishedActivityId: true,
  reviewDecision: true,
  applyResult: true,
  qualityScore: true,
  confidenceScore: true,
  matchStatus: true,
  source: { select: { id: true, name: true, slug: true, type: true } },
} as const;

/** Поля ImportReviewTask, используемые в UI страницы. */
const importReviewTaskScalarsForDetailSelect = {
  id: true,
  status: true,
  suggestedAction: true,
  reviewedAt: true,
  priority: true,
  notes: true,
  reviewerUserId: true,
  decision: true,
} as const;

async function getReviewEntry(id: string) {
  const taskRow = await prisma.importReviewTask.findUnique({
    where: { id },
    select: {
      ...importReviewTaskScalarsForDetailSelect,
      importedRecord: { select: importedRecordForReviewDetailSelect },
    },
  });

  if (taskRow) {
    const [reconciledRecord] = await reconcileImportedRecordLinks([taskRow.importedRecord], prisma);
    const { importedRecord: _ignored, ...reviewTask } = taskRow;
    return {
      importedRecord: reconciledRecord,
      reviewTask,
    };
  }

  const record = await prisma.importedRecord.findUnique({
    where: { id },
    select: {
      ...importedRecordForReviewDetailSelect,
      reviewTask: { select: importReviewTaskScalarsForDetailSelect },
    },
  });

  if (!record) return null;

  const { reviewTask, ...importedRecord } = record;
  const [reconciledRecord] = await reconcileImportedRecordLinks([importedRecord], prisma);

  return {
    importedRecord: {
      ...importedRecord,
      ...reconciledRecord,
    },
    reviewTask,
  };
}

async function getPlacesForCandidates(ids: string[]) {
  if (!ids.length) return [];
  return prisma.place.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, title: true, phone: true, website: true,
      formattedAddr: true, customAddress: true, lat: true, lng: true,
      status: true, city: { select: { name: true } },
    },
  });
}

async function getActivitiesForCandidates(ids: string[]) {
  if (!ids.length) return [];
  return prisma.activity.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, title: true, type: true, scheduleMode: true,
      status: true, nextOccurrenceAt: true, cityId: true,
      venue: { select: { title: true, addressLine: true, kind: true } },
    },
  });
}

async function getApplyActorLabel(
  applyResult: import("@/server/modules/import/types").ImportApplyResultPayload | null,
) {
  const userId = applyResult?.appliedByUserId?.trim();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });

  if (!user) return userId;
  return `${user.role} — ${user.email}`;
}

async function resolveApplyResultWithSlug(params: {
  entityType: string | null;
  publishedActivityId: string | null;
  applyResult: import("@/server/modules/import/types").ImportApplyResultPayload | null;
}) {
  const { entityType, publishedActivityId, applyResult } = params;
  if (!applyResult || entityType !== "EVENT" || applyResult.activitySlug) {
    return applyResult;
  }

  const activityId = applyResult.activityId ?? publishedActivityId ?? null;
  if (!activityId) return applyResult;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { slug: true },
  });

  if (!activity?.slug) return applyResult;

  return {
    ...applyResult,
    activityId,
    activitySlug: activity.slug,
  } satisfies import("@/server/modules/import/types").ImportApplyResultPayload;
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 min-w-0 break-words">{value}</span>
    </div>
  );
}

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

function QualityBar({ score }: { score: number }) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
      <div className="text-xs text-gray-500">Quality score</div>
      <div className="flex items-center gap-2">
        <div className="h-2 w-32 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.round(score * 100)}%` }} />
        </div>
        <span className="text-sm font-medium text-gray-700">{(score * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ── Source block (shared) ─────────────────────────────────────────────────────

function SourceBlock({
  rec,
}: {
  rec: {
    source: { name: string; slug: string; type: string };
    sourceUrl: string | null;
    externalId: string | null;
    fetchedAt: Date | null;
    parseStatus: string;
    normalizeStatus: string;
    rawText: string | null;
    rawPayload: unknown;
  };
}) {
  const rawPayload = rec.rawPayload as Record<string, unknown> | null;
  const STATUS_COLORS = {
    SUCCESS: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    PENDING: "bg-gray-100 text-gray-600",
    SKIPPED: "bg-gray-100 text-gray-600",
  };
  return (
    <details className="rounded-lg border border-gray-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-800">
        Источник
      </summary>
      <div className="border-t border-gray-100 p-4">
        <Field label="URL источника" value={rec.sourceUrl} />
        <Field label="ID источника" value={rec.externalId} />
        <Field
          label="Дата загрузки"
          value={rec.fetchedAt ? format(rec.fetchedAt, "dd MMM yyyy HH:mm", { locale: ru }) : null}
        />
        <Field label="Normalize status" value={<Badge value={rec.normalizeStatus} colorMap={STATUS_COLORS} />} />
        <Field label="Parse status" value={<Badge value={rec.parseStatus} colorMap={STATUS_COLORS} />} />
        {rec.rawText && (
          <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
            {rec.rawText.slice(0, 500)}
          </pre>
        )}
        {rawPayload && (
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
            {JSON.stringify(rawPayload, null, 2).slice(0, 800)}
          </pre>
        )}
      </div>
    </details>
  );
}

// ── PLACE normalized block ────────────────────────────────────────────────────

function PlaceNormalizedBlock({ nd, qualityScore }: { nd: NormalizedPlaceImport; qualityScore: number }) {
  return (
    <Section title="Нормализованные данные — PLACE">
      <Field label="Название" value={nd.title} />
      <Field label="Краткое описание" value={nd.shortDescCandidate} />
      <Field label="Описание" value={nd.description} />
      <Field
        label="Категории"
        value={nd.categoryCandidates.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {nd.categoryCandidates.map((c) => (
              <span key={c} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{c}</span>
            ))}
          </div>
        ) : null}
      />
      <Field label="Адрес" value={nd.addressText} />
      <Field label="Город" value={nd.cityName} />
      <Field
        label="Координаты"
        value={nd.lat != null && nd.lng != null ? `${nd.lat.toFixed(6)}, ${nd.lng.toFixed(6)}` : null}
      />
      <Field
        label="Телефоны"
        value={nd.phones.length > 0 ? (
          <div className="space-y-0.5">{nd.phones.map((p) => <div key={p}>{p}</div>)}</div>
        ) : null}
      />
      <Field
        label="Сайты"
        value={nd.websites.length > 0 ? (
          <div className="space-y-0.5">
            {nd.websites.map((w) => (
              <a key={w} href={w} target="_blank" rel="noopener noreferrer"
                className="block text-blue-600 hover:underline break-all">{w}</a>
            ))}
          </div>
        ) : null}
      />
      <Field
        label="Изображения"
        value={nd.imageUrls.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-1">
            {nd.imageUrls.slice(0, 4).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-16 w-16 rounded object-cover border border-gray-200" />
            ))}
            {nd.imageUrls.length > 4 && (
              <span className="text-xs text-gray-400 self-center">+{nd.imageUrls.length - 4} ещё</span>
            )}
          </div>
        ) : null}
      />
      <Field label="Часы работы" value={nd.openingHoursText} />
      <QualityBar score={qualityScore} />
    </Section>
  );
}

// ── EVENT normalized block ────────────────────────────────────────────────────

function buildEventImportImageRows(nd: NormalizedEventImport) {
  const seen = new Set<string>();
  const rows: { url: string; label: string }[] = [];

  const main = nd.mainImageUrl?.trim() || null;
  let rest = nd.imageUrls
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  if (main) {
    rest = rest.filter((u) => u !== main);
    seen.add(main);
    rows.push({ url: main, label: "Постер (импорт)" });
  } else if (rest.length > 0) {
    const first = rest[0];
    seen.add(first);
    rows.push({ url: first, label: "Постер (импорт)" });
    rest = rest.slice(1);
  }

  for (const u of rest) {
    if (seen.has(u)) continue;
    seen.add(u);
    rows.push({ url: u, label: "Галерея (импорт)" });
  }
  return rows;
}

function EventNormalizedBlock({ nd, qualityScore }: { nd: NormalizedEventImport; qualityScore: number }) {
  const importImageRows = buildEventImportImageRows(nd);

  return (
    <Section title="Нормализованные данные — EVENT">
      <Field label="Название" value={nd.title} />
      <Field label="Краткое описание" value={nd.shortDescCandidate} />
      <Field label="Описание" value={nd.description} />
      <Field
        label="Тип (кандидат)"
        value={nd.typeCandidate ? (
          <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800 font-medium">
            {nd.typeCandidate}
          </span>
        ) : <span className="text-xs text-gray-400 italic">не определён</span>}
      />
      <Field
        label="Режим расписания"
        value={nd.scheduleModeCandidate ? (
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800 font-medium">
            {nd.scheduleModeCandidate}
          </span>
        ) : <span className="text-xs text-gray-400 italic">не определён</span>}
      />
      <Field label="Площадка" value={nd.venueName} />
      <Field label="Адрес" value={nd.addressText} />
      <Field label="Город" value={nd.cityName} />
      <Field label="Начало" value={nd.startAt} />
      <Field label="Конец" value={nd.endAt} />
      <Field label="Расписание (текст)" value={nd.scheduleText} />
      <Field label="Возраст" value={nd.ageText} />
      <Field label="Цена" value={nd.priceText} />
      <Field label="Организатор" value={nd.organizerName} />
      <Field
        label="Категории"
        value={nd.categoryCandidates.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {nd.categoryCandidates.map((c) => (
              <span key={c} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{c}</span>
            ))}
          </div>
        ) : null}
      />
      <Field label="Главное изображение (URL)" value={nd.mainImageUrl ?? null} />
      <Field
        label="Изображения (импорт)"
        value={
          importImageRows.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                URL со страницы источника. В медиатеку попадают только после нажатия кнопки.
              </p>
              <ImportEventMediaIngest rows={importImageRows} />
            </div>
          ) : null
        }
      />
      <QualityBar score={qualityScore} />
    </Section>
  );
}

function PlaceCatalogBlock({ nd }: { nd: NormalizedPlaceImport }) {
  return (
    <Section title="Что будет создано">
      <Field label="Название" value={nd.title} />
      <Field label="Описание" value={nd.description ?? nd.shortDescCandidate} />
      <Field label="Место" value={nd.title} />
      <Field label="Адрес" value={nd.addressText} />
      <Field label="Город" value={nd.cityName} />
      <Field
        label="Категории"
        value={nd.categoryCandidates.length > 0 ? nd.categoryCandidates.join(", ") : null}
      />
      <Field
        label="Изображение"
        value={
          nd.imageUrls.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nd.imageUrls[0]} alt="" className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
          ) : null
        }
      />
    </Section>
  );
}

function EventCatalogBlock({ nd }: { nd: NormalizedEventImport }) {
  const importImageRows = buildEventImportImageRows(nd);
  return (
    <Section title="Что будет создано">
      <Field label="Название" value={nd.title} />
      <Field label="Описание" value={nd.description ?? nd.shortDescCandidate} />
      <Field label="Дата и время" value={nd.startAt ?? nd.scheduleText} />
      <Field label="Место" value={nd.venueName} />
      <Field label="Адрес" value={nd.addressText} />
      <Field label="Город" value={nd.cityName} />
      <Field label="Возраст" value={nd.ageText} />
      <Field label="Цена" value={nd.priceText} />
      <Field
        label="Категории"
        value={nd.categoryCandidates.length > 0 ? nd.categoryCandidates.join(", ") : null}
      />
      <Field
        label="Изображение"
        value={importImageRows.length > 0 ? <ImportEventMediaIngest rows={importImageRows} /> : null}
      />
    </Section>
  );
}

function NeedsAttentionBlock({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Section title="Нужно уточнить">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {item}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PLACE match candidates block ──────────────────────────────────────────────

function PlaceCandidatesBlock({
  candidates,
  placeMap,
}: {
  candidates: PlaceMatchCandidate[];
  placeMap: Record<string, { title: string; phone: string | null; website: string | null; formattedAddr: string | null; customAddress: string | null; status: string; city: { name: string } | null }>;
}) {
  return (
    <Section title="Совпадения">
      {candidates.length === 0 ? (
        <p className="text-sm text-gray-600">Похожих объектов не найдено. Рекомендуется создать новое событие.</p>
      ) : (
        <div className="space-y-4">
          {candidates.map((c, idx) => {
            const place = placeMap[c.entityId];
            const isTop = idx === 0;
            return (
              <div key={c.entityId}
                className={`rounded-lg border p-4 ${isTop ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    {isTop && <span className="text-xs font-medium text-blue-700 bg-blue-100 rounded px-1.5 py-0.5 mr-2">Лучшее совпадение</span>}
                    <span className="font-medium text-gray-900">{c.entityTitle}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gray-900">{(c.score * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">score</div>
                  </div>
                </div>
                {place && (
                  <div className="text-xs text-gray-600 space-y-0.5 border-t border-gray-200 pt-2">
                    {place.formattedAddr && <div>📍 {place.formattedAddr}</div>}
                    {place.phone && <div>📞 {place.phone}</div>}
                    {place.website && (
                      <div>🌐 <a href={place.website} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline">{place.website}</a></div>
                    )}
                    {place.city && <div>🏙 {place.city.name}</div>}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700">Связать</span>
                  <span className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700">Обновить</span>
                  <Link href={`/admin/content/places/${c.entityId}`} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                    Открыть
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ── EVENT match candidates block ──────────────────────────────────────────────

function EventCandidatesBlock({
  candidates,
  activityMap,
}: {
  candidates: EventMatchCandidate[];
  activityMap: Record<string, {
    id: string; title: string; type: string; scheduleMode: string;
    status: string; nextOccurrenceAt: Date | null;
    venue: { title: string | null; addressLine: string | null; kind: string } | null;
    cityId: string | null;
  }>;
}) {
  return (
    <Section title="Совпадения">
      {candidates.length === 0 ? (
        <p className="text-sm text-gray-600">Похожих объектов не найдено. Рекомендуется создать новое событие.</p>
      ) : (
        <div className="space-y-4">
          {candidates.map((c, idx) => {
            const activity = activityMap[c.entityId];
            const isTop = idx === 0;
            const hasOccurrenceRisk = c.signals.possibleOccurrenceRisk;
            return (
              <div key={c.entityId}
                className={`rounded-lg border p-4 ${
                  hasOccurrenceRisk
                    ? "border-orange-300 bg-orange-50"
                    : isTop
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 bg-white"
                }`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isTop && !hasOccurrenceRisk && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-100 rounded px-1.5 py-0.5">Лучшее совпадение</span>
                    )}
                    <span className="font-medium text-gray-900">{c.entityTitle}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gray-900">{(c.score * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">score</div>
                  </div>
                </div>

                {activity && (
                  <div className="text-xs text-gray-600 space-y-0.5 border-t border-gray-200 pt-2">
                    {activity.nextOccurrenceAt && (
                      <div>📅 {format(activity.nextOccurrenceAt, "dd MMM yyyy", { locale: ru })}</div>
                    )}
                    {activity.venue?.title && <div>🏛 {activity.venue.title}</div>}
                    {activity.venue?.addressLine && <div>📍 {activity.venue.addressLine}</div>}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700">Связать</span>
                  <span className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700">Обновить</span>
                  <Link href={`/editor/event/${c.entityId}/edit?returnTo=${encodeURIComponent("/admin/import/review")}`} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                    Открыть
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function recommendationLabel(action: string | null): string {
  if (action === "CREATE_NEW") return "Создать новое";
  if (action === "UPDATE_EXISTING") return "Обновить";
  if (action === "MERGE") return "Требует объединения";
  return "Требует проверки";
}

function importStatusLabel(status: string): string {
  if (status === "APPROVED") return "Одобрено";
  if (status === "REJECTED") return "Отклонено";
  if (status === "PENDING") return "Ожидает решения";
  return status;
}

function TechnicalAccordion({
  rec,
  task,
}: {
  rec: {
    sourceUrl: string | null;
    externalId: string | null;
    fetchedAt: Date | null;
    parseStatus: string;
    normalizeStatus: string;
    rawPayload: unknown;
    rawText: string | null;
    matchStatus: string | null;
    confidenceScore: number | null;
  };
  task: {
    status: string;
    priority: number;
    reviewedAt: Date | null;
    reviewerUserId: string | null;
    decision: string | null;
    notes: string | null;
  } | null;
}) {
  const rawPayload = rec.rawPayload as Record<string, unknown> | null;
  return (
    <details className="rounded-lg border border-gray-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-800">
        Технические данные
      </summary>
      <div className="border-t border-gray-100 p-4">
        <Field label="URL источника" value={rec.sourceUrl} />
        <Field label="ID источника" value={rec.externalId} />
        <Field
          label="Дата загрузки"
          value={rec.fetchedAt ? format(rec.fetchedAt, "dd MMM yyyy HH:mm", { locale: ru }) : null}
        />
        <Field label="Parse status" value={rec.parseStatus} />
        <Field label="Normalize status" value={rec.normalizeStatus} />
        <Field label="Task status" value={task?.status ?? null} />
        <Field label="Priority" value={task ? String(task.priority) : null} />
        <Field label="Decision" value={task?.decision ?? null} />
        <Field label="Reviewer" value={task?.reviewerUserId ?? null} />
        <Field
          label="Reviewed at"
          value={task?.reviewedAt ? format(task.reviewedAt, "dd MMM yyyy HH:mm", { locale: ru }) : null}
        />
        <Field label="Match status" value={rec.matchStatus} />
        <Field
          label="Confidence score"
          value={rec.confidenceScore != null ? `${(rec.confidenceScore * 100).toFixed(0)}%` : null}
        />
        <Field label="Notes" value={task?.notes ?? null} />
        {rec.rawText && (
          <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
            {rec.rawText.slice(0, 600)}
          </pre>
        )}
        {rawPayload && (
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700">
            {JSON.stringify(rawPayload, null, 2).slice(0, 1200)}
          </pre>
        )}
      </div>
    </details>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await getReviewEntry(id);
  if (!entry) notFound();

  const rec = entry.importedRecord;
  const task = entry.reviewTask;
  const entityType = rec.entityTypeHint; // "PLACE" | "EVENT" | null
  const rawCandidates = ((rec.matchCandidates ?? []) as unknown) as (PlaceMatchCandidate | EventMatchCandidate)[];

  // Fetch entity details for candidates
  const isEventRecord = entityType === "EVENT";
  const candidateIds = rawCandidates.map((c) => c.entityId);

  const [placeDetails, activityDetails] = await Promise.all([
    isEventRecord ? [] : getPlacesForCandidates(candidateIds),
    isEventRecord ? getActivitiesForCandidates(candidateIds) : [],
  ]);

  const placeMap = Object.fromEntries(placeDetails.map((p) => [p.id, p]));
  const activityMap = Object.fromEntries(activityDetails.map((a) => [a.id, a]));

  const nd = rec.normalizedData as (NormalizedPlaceImport | NormalizedEventImport) | null;
  const isAlreadyApplied = !!rec.publishedPlaceId || !!rec.publishedActivityId;
  const resolvedApplyResult = await resolveApplyResultWithSlug({
    entityType,
    publishedActivityId: rec.publishedActivityId,
    applyResult:
      (rec.applyResult as import("@/server/modules/import/types").ImportApplyResultPayload | null) ?? null,
  });
  const applyActorLabel = await getApplyActorLabel(
    resolvedApplyResult,
  );

  return (
    <div className="p-6 max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/admin/import/review" className="hover:text-gray-700">← Ревью</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate max-w-xs">
            {nd?.title ?? rec.externalId ?? id}
          </span>
        </div>
      </div>

      <Section title="Сводка">
        <Field label="Название" value={nd?.title ?? null} />
        <Field label="Тип" value={isEventRecord ? "Событие" : "Место"} />
        <Field label="Источник" value={rec.source?.name ? `${rec.source.name}` : null} />
        <Field label="Статус импорта" value={importStatusLabel(rec.reviewStatus)} />
        <Field
          label="Рекомендация"
          value={recommendationLabel(task?.suggestedAction ?? null)}
        />
        <div className="pt-2">
          <QualityBar score={rec.qualityScore ?? 0} />
        </div>
      </Section>

      {!task && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
          Ошибка пайплайна: у этой <code className="rounded bg-rose-100 px-1">ImportedRecord</code> нет связанной{" "}
          <code className="rounded bg-rose-100 px-1">ImportReviewTask</code>. Выполните repair в админке или скриптом, затем
          при необходимости «Rematch» на странице run.
        </div>
      )}

      {nd && nd.entityType === "PLACE" && (
        <PlaceCatalogBlock nd={nd as NormalizedPlaceImport} />
      )}
      {nd && nd.entityType === "EVENT" && (
        <EventCatalogBlock nd={nd as NormalizedEventImport} />
      )}

      <NeedsAttentionBlock
        items={[
          ...(nd && nd.entityType === "EVENT" && !nd.typeCandidate
            ? ["Тип активности не определён"]
            : []),
          ...(nd && nd.entityType === "EVENT" && !nd.scheduleModeCandidate
            ? ["Режим расписания не определён"]
            : []),
          ...(nd && nd.entityType === "EVENT" && nd.ageText?.includes("+")
            ? ["Возраст указан в свободной форме, рекомендуется выбрать возрастные группы"]
            : []),
          ...(nd && nd.entityType === "EVENT" && !nd.venueName
            ? ["Площадка будет найдена или создана автоматически"]
            : []),
        ]}
      />

      {/* C. Match candidates — entity-specific */}
      {!isEventRecord && (
        <PlaceCandidatesBlock
          candidates={rawCandidates as PlaceMatchCandidate[]}
          placeMap={placeMap}
        />
      )}
      {isEventRecord && (
        <EventCandidatesBlock
          candidates={rawCandidates as EventMatchCandidate[]}
          activityMap={activityMap}
        />
      )}

      <SourceBlock rec={rec} />

      <TechnicalAccordion
        rec={{
          sourceUrl: rec.sourceUrl,
          externalId: rec.externalId,
          fetchedAt: rec.fetchedAt,
          parseStatus: rec.parseStatus,
          normalizeStatus: rec.normalizeStatus,
          rawPayload: rec.rawPayload,
          rawText: rec.rawText,
          matchStatus: rec.matchStatus,
          confidenceScore: rec.confidenceScore,
        }}
        task={task}
      />

      <ReviewDetailWorkflow
        task={
          task
            ? {
                id: task.id,
                status: task.status,
                suggestedAction: task.suggestedAction,
                reviewedAt: task.reviewedAt ? task.reviewedAt.toISOString() : null,
                priority: task.priority,
                notes: task.notes,
                reviewerUserId: task.reviewerUserId,
                decision: task.decision,
              }
            : null
        }
        importedRecord={{
          id: rec.id,
          reviewStatus: rec.reviewStatus,
          reviewDecision: rec.reviewDecision as import("@/server/modules/import/types").ReviewDecisionPayload | null,
          publishedPlaceId: rec.publishedPlaceId,
          publishedActivityId: rec.publishedActivityId,
          applyResult: resolvedApplyResult,
        }}
        entityType={entityType === "EVENT" ? "EVENT" : "PLACE"}
        applyActorLabel={applyActorLabel}
        candidates={rawCandidates}
        normalizedEventData={
          nd && nd.entityType === "EVENT"
            ? {
                typeCandidate: nd.typeCandidate,
                scheduleModeCandidate: nd.scheduleModeCandidate,
                venueName: nd.venueName,
              }
            : null
        }
      />
    </div>
  );
}
