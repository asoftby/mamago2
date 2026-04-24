
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
import { ReviewDetailActions } from "./_components/ReviewDetailActions";
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

function SignalBadge({ label, active, partial, warn }: {
  label: string; active: boolean; partial?: boolean; warn?: boolean;
}) {
  const cls = warn
    ? "bg-orange-100 text-orange-800 border-orange-300"
    : active
      ? "bg-green-100 text-green-800 border-green-200"
      : partial
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : "bg-gray-50 text-gray-400 border-gray-200";
  const icon = warn ? "⚠" : active ? "✓" : partial ? "~" : "✗";
  return (
    <div className={`rounded border px-2 py-1 text-xs flex items-center gap-1 ${cls}`}>
      <span>{icon}</span><span>{label}</span>
    </div>
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

const MATCH_COLORS: Record<string, string> = {
  NO_MATCH: "bg-blue-50 text-blue-700",
  MATCHED: "bg-green-100 text-green-800",
  AMBIGUOUS: "bg-yellow-100 text-yellow-800",
  FAILED: "bg-red-100 text-red-800",
  PENDING: "bg-gray-100 text-gray-600",
};

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
    <Section title="Источник и сырые данные">
      <Field label="Источник" value={`${rec.source.name} (${rec.source.slug})`} />
      <Field label="Тип источника" value={rec.source.type} />
      <Field
        label="Source URL"
        value={rec.sourceUrl ? (
          <a href={rec.sourceUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:underline break-all">{rec.sourceUrl}</a>
        ) : null}
      />
      <Field label="External ID" value={rec.externalId} />
      <Field
        label="Fetched at"
        value={rec.fetchedAt ? format(rec.fetchedAt, "dd MMM yyyy HH:mm", { locale: ru }) : null}
      />
      <Field label="Parse status" value={<Badge value={rec.parseStatus} colorMap={STATUS_COLORS} />} />
      <Field label="Normalize status" value={<Badge value={rec.normalizeStatus} colorMap={STATUS_COLORS} />} />
      {rec.rawText && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">Raw text (preview)</div>
          <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-32 text-gray-700 whitespace-pre-wrap">
            {rec.rawText.slice(0, 500)}{rec.rawText.length > 500 ? "…" : ""}
          </pre>
        </div>
      )}
      {rawPayload && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">Raw payload (preview)</div>
          <pre className="text-xs bg-gray-50 rounded p-3 overflow-auto max-h-40 text-gray-700">
            {JSON.stringify(rawPayload, null, 2).slice(0, 800)}
            {JSON.stringify(rawPayload).length > 800 ? "\n…" : ""}
          </pre>
        </div>
      )}
    </Section>
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

// ── PLACE match candidates block ──────────────────────────────────────────────

function PlaceCandidatesBlock({
  candidates,
  placeMap,
  confidenceScore,
}: {
  candidates: PlaceMatchCandidate[];
  placeMap: Record<string, { title: string; phone: string | null; website: string | null; formattedAddr: string | null; customAddress: string | null; status: string; city: { name: string } | null }>;
  confidenceScore: number | null;
}) {
  return (
    <Section title={`Match candidates — PLACE (${candidates.length})`}>
      {candidates.length === 0 ? (
        <p className="text-sm text-gray-400">Совпадений не найдено — рекомендуется CREATE_NEW.</p>
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
                    {isTop && <span className="text-xs font-medium text-blue-700 bg-blue-100 rounded px-1.5 py-0.5 mr-2">top match</span>}
                    <span className="font-medium text-gray-900">{c.entityTitle}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gray-900">{(c.score * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">score</div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-3 italic">{c.reason}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  <SignalBadge label="Website domain" active={c.signals.websiteDomainExact} />
                  <SignalBadge label="Phone" active={c.signals.phoneExact} />
                  <SignalBadge label={`Title ~${(c.signals.titleSimilarity * 100).toFixed(0)}%`}
                    active={c.signals.titleSimilarity >= 0.5}
                    partial={c.signals.titleSimilarity > 0 && c.signals.titleSimilarity < 0.5} />
                  <SignalBadge label={`Address ~${(c.signals.addressSimilarity * 100).toFixed(0)}%`}
                    active={c.signals.addressSimilarity >= 0.5}
                    partial={c.signals.addressSimilarity > 0 && c.signals.addressSimilarity < 0.5} />
                  {c.signals.coordsDistanceMeters != null && (
                    <SignalBadge label={`Coords ${c.signals.coordsDistanceMeters}m`}
                      active={c.signals.coordsDistanceMeters <= 100}
                      partial={c.signals.coordsDistanceMeters <= 500} />
                  )}
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
                    <div className="text-gray-400">status: {place.status}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {confidenceScore != null && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
          <span>Confidence:</span>
          <span className="font-medium text-gray-700">{(confidenceScore * 100).toFixed(0)}%</span>
        </div>
      )}
    </Section>
  );
}

// ── EVENT match candidates block ──────────────────────────────────────────────

function EventCandidatesBlock({
  candidates,
  activityMap,
  confidenceScore,
}: {
  candidates: EventMatchCandidate[];
  activityMap: Record<string, {
    id: string; title: string; type: string; scheduleMode: string;
    status: string; nextOccurrenceAt: Date | null;
    venue: { title: string | null; addressLine: string | null; kind: string } | null;
    cityId: string | null;
  }>;
  confidenceScore: number | null;
}) {
  return (
    <Section title={`Match candidates — ACTIVITY (${candidates.length})`}>
      {candidates.length === 0 ? (
        <p className="text-sm text-gray-400">Совпадений не найдено — рекомендуется CREATE_NEW.</p>
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
                      <span className="text-xs font-medium text-blue-700 bg-blue-100 rounded px-1.5 py-0.5">top match</span>
                    )}
                    {hasOccurrenceRisk && (
                      <span className="text-xs font-medium text-orange-800 bg-orange-200 rounded px-1.5 py-0.5">
                        ⚠ occurrence risk
                      </span>
                    )}
                    <span className="font-medium text-gray-900">{c.entityTitle}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-gray-900">{(c.score * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">score</div>
                  </div>
                </div>

                {hasOccurrenceRisk && (
                  <div className="mb-3 rounded bg-orange-100 border border-orange-200 px-3 py-2 text-xs text-orange-800">
                    Похожее название и площадка, но дата отличается на{" "}
                    <strong>{c.signals.startDateDeltaDays?.toFixed(1)} дн.</strong> — возможно это повтор/occurrence, а не дубль.
                    Требуется ручная проверка.
                  </div>
                )}

                <p className="text-xs text-gray-600 mb-3 italic">{c.reason}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  <SignalBadge label={`Title ~${(c.signals.titleSimilarity * 100).toFixed(0)}%`}
                    active={c.signals.titleSimilarity >= 0.5}
                    partial={c.signals.titleSimilarity > 0 && c.signals.titleSimilarity < 0.5} />
                  <SignalBadge label={`Venue ~${(c.signals.venueSimilarity * 100).toFixed(0)}%`}
                    active={c.signals.venueSimilarity >= 0.5}
                    partial={c.signals.venueSimilarity > 0 && c.signals.venueSimilarity < 0.5} />
                  <SignalBadge label={`Address ~${(c.signals.addressSimilarity * 100).toFixed(0)}%`}
                    active={c.signals.addressSimilarity >= 0.5}
                    partial={c.signals.addressSimilarity > 0 && c.signals.addressSimilarity < 0.5} />
                  <SignalBadge label={`Organizer ~${(c.signals.organizerSimilarity * 100).toFixed(0)}%`}
                    active={c.signals.organizerSimilarity >= 0.5}
                    partial={c.signals.organizerSimilarity > 0 && c.signals.organizerSimilarity < 0.5} />
                  {c.signals.startDateDeltaDays != null && (
                    <SignalBadge
                      label={`Date Δ${c.signals.startDateDeltaDays.toFixed(1)}d`}
                      active={c.signals.startDateDeltaDays <= 3}
                      partial={c.signals.startDateDeltaDays <= 14}
                      warn={hasOccurrenceRisk} />
                  )}
                  {c.signals.possibleOccurrenceRisk && (
                    <SignalBadge label="Occurrence risk" active={false} warn={true} />
                  )}
                </div>

                {activity && (
                  <div className="text-xs text-gray-600 space-y-0.5 border-t border-gray-200 pt-2">
                    <div>
                      <span className="text-gray-400">type:</span>{" "}
                      <span className="font-medium">{activity.type}</span>
                      {" · "}
                      <span className="text-gray-400">schedule:</span>{" "}
                      <span className="font-medium">{activity.scheduleMode}</span>
                    </div>
                    {activity.nextOccurrenceAt && (
                      <div>📅 {format(activity.nextOccurrenceAt, "dd MMM yyyy", { locale: ru })}</div>
                    )}
                    {activity.venue?.title && <div>🏛 {activity.venue.title}</div>}
                    {activity.venue?.addressLine && <div>📍 {activity.venue.addressLine}</div>}
                    {activity.cityId && <div className="text-gray-400">cityId: {activity.cityId}</div>}
                    <div className="text-gray-400">status: {activity.status}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {confidenceScore != null && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
          <span>Confidence:</span>
          <span className="font-medium text-gray-700">{(confidenceScore * 100).toFixed(0)}%</span>
        </div>
      )}
    </Section>
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

  const entityBadgeClass = isEventRecord
    ? "bg-violet-100 text-violet-800"
    : "bg-sky-100 text-sky-800";

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
        <ReviewDetailActions
          importedRecordId={rec.id}
          isApplied={isAlreadyApplied}
        />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {entityType && (
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${entityBadgeClass}`}>
                {entityType}
              </span>
            )}
            <h1 className="text-xl font-semibold text-gray-900">
              {nd?.title ?? <span className="text-gray-400 italic">Без названия</span>}
            </h1>
          </div>
          {rec.matchStatus && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge value={rec.matchStatus} colorMap={MATCH_COLORS} />
            </div>
          )}
        </div>
        <div className="text-right text-xs text-gray-400 shrink-0">
          <div>priority: {task?.priority ?? "—"}</div>
        </div>
      </div>

      {!task && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
          Ошибка пайплайна: у этой <code className="rounded bg-rose-100 px-1">ImportedRecord</code> нет связанной{" "}
          <code className="rounded bg-rose-100 px-1">ImportReviewTask</code>. Выполните repair в админке или скриптом, затем
          при необходимости «Rematch» на странице run.
        </div>
      )}

      {/* A. Source block */}
      <SourceBlock rec={rec} />

      {/* B. Normalized block — entity-specific */}
      {nd && nd.entityType === "PLACE" && (
        <PlaceNormalizedBlock nd={nd as NormalizedPlaceImport} qualityScore={rec.qualityScore ?? 0} />
      )}
      {nd && nd.entityType === "EVENT" && (
        <EventNormalizedBlock nd={nd as NormalizedEventImport} qualityScore={rec.qualityScore ?? 0} />
      )}

      {/* C. Match candidates — entity-specific */}
      {!isEventRecord && (
        <PlaceCandidatesBlock
          candidates={rawCandidates as PlaceMatchCandidate[]}
          placeMap={placeMap}
          confidenceScore={rec.confidenceScore}
        />
      )}
      {isEventRecord && (
        <EventCandidatesBlock
          candidates={rawCandidates as EventMatchCandidate[]}
          activityMap={activityMap}
          confidenceScore={rec.confidenceScore}
        />
      )}

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
        matchStatus={rec.matchStatus}
        qualityScore={rec.qualityScore}
        confidenceScore={rec.confidenceScore}
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
