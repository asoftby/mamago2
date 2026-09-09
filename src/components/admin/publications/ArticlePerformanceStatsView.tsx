"use client";

import type {
  ArticlePerformanceBlockStats,
  ArticlePerformanceStatsPayload,
} from "@/lib/article/articlePerformanceStats";

const BLOCK_LABEL: Record<string, string> = {
  contacts: "Контакты",
  price: "Стоимость",
  openingHours: "Режим работы",
  activityCard: "Карточка публикации",
};

const ACTION_LABEL: Record<string, string> = {
  phone: "Телефон",
  route: "Маршрут",
  coordinates: "Координаты",
  email: "Email",
  website: "Сайт",
  social: "Соцсети",
  card_open: "Открыли публикацию",
};

const ITEM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  telegram: "Telegram",
  vk: "ВКонтакте",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function n(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

function date(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">{value}</div>
      {note ? <div className="mt-1 text-[10px] text-gray-400">{note}</div> : null}
    </div>
  );
}

function blockActionRows(block: ArticlePerformanceBlockStats) {
  const rows: Array<{ label: string; value: number }> = [];
  for (const [action, value] of Object.entries(block.actions)) {
    if (!value) continue;
    rows.push({ label: ACTION_LABEL[action] ?? action, value });
  }
  for (const [key, value] of Object.entries(block.actionItems)) {
    const [action, item] = key.split(":", 2);
    if (!item || !value) continue;
    const detail = ITEM_LABEL[item] ?? (item.startsWith("phone_") ? `Телефон ${item.slice(6)}` : item);
    rows.push({ label: `↳ ${ACTION_LABEL[action] ?? action}: ${detail}`, value });
  }
  return rows;
}

export function ArticlePerformanceStatsView({ data }: { data: ArticlePerformanceStatsPayload }) {
  const noTraffic = data.metrics.views === 0 && data.metrics.targetActions === 0;
  const unpublished = data.article.status !== "PUBLISHED";

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
        <div className="grid gap-2 text-[12px] text-gray-600 sm:grid-cols-2">
          <div><span className="text-gray-400">Опубликовано:</span> {date(data.article.publishedAt)}</div>
          <div><span className="text-gray-400">Обновлено:</span> {date(data.article.updatedAt)}</div>
        </div>
        <div className="mt-2 text-[11px] text-gray-400">Статистика обновлена: {date(data.statsUpdatedAt)}</div>
      </section>

      {unpublished ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Статья ещё не опубликована. Публичная статистика начнёт собираться после публикации.
        </div>
      ) : noTraffic ? (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500">
          Пока нет просмотров за выбранный период.
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Результат публикации</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Metric label="Просмотры" value={n(data.metrics.views)} note="статья видима ≥ 1 сек." />
          <Metric label="Уникальные читатели" value={n(data.metrics.uniqueReaders)} note="уникальные сессии" />
          <Metric
            label="Дочитали 75%"
            value={pct(data.metrics.read75Rate)}
            note={`${n(data.metrics.read75)} · полностью ${pct(data.metrics.completionRate)}`}
          />
          <Metric label="Сохранили" value={n(data.metrics.saves)} />
          <Metric label="Поделились" value={n(data.metrics.shares)} />
          <Metric label="Оценили" value={n(data.metrics.ratings)} note={`Положительно: ${pct(data.metrics.positiveRatingRate)}`} />
          <Metric label="Целевые действия в блоках" value={n(data.metrics.targetActions)} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Поделились статьёй</h3>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
          <div className="flex justify-between gap-3"><span>Telegram</span><strong>{n(data.shares.telegram)}</strong></div>
          <div className="flex justify-between gap-3"><span>WhatsApp</span><strong>{n(data.shares.whatsapp)}</strong></div>
          <div className="flex justify-between gap-3"><span>Скопировали ссылку</span><strong>{n(data.shares.copy)}</strong></div>
          <div className="flex justify-between gap-3"><span>Системное меню</span><strong>{n(data.shares.native)}</strong></div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Оценка читателей</h3>
          <span className="text-xs text-gray-400">{n(data.ratings.total)} оценок</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">😍 Нравится <strong className="float-right">{n(data.ratings.like)}</strong></div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">🙂 Нормально <strong className="float-right">{n(data.ratings.neutral)}</strong></div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">😫 Не нравится <strong className="float-right">{n(data.ratings.dislike)}</strong></div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Объекты и блоки в статье</h3>
          <span className="text-[11px] text-gray-400">показы → точные действия</span>
        </div>
        {data.subjects.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-5 text-sm text-gray-500">
            За выбранный период нет данных по измеряемым блокам.
          </div>
        ) : (
          <div className="space-y-2">
            {data.subjects.map((subject) => (
              <details key={subject.subjectId} className="group rounded-xl border border-gray-100 bg-white" open={data.subjects.length <= 3}>
                <summary className="cursor-pointer list-none px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{subject.title}</div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                        {subject.source === "CATALOG" ? "Публикация mamaGo" : subject.source === "MANUAL" ? "Объект статьи" : "Legacy-блок"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-gray-900">{n(subject.targetActions)} действий</div>
                      <div className="text-[11px] text-gray-400">{n(subject.impressions)} показов · CTR {pct(subject.ctr)}</div>
                    </div>
                  </div>
                </summary>
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="space-y-3">
                    {subject.blocks.map((block) => {
                      const actions = blockActionRows(block);
                      return (
                        <div key={block.blockId} className="rounded-lg bg-gray-50/80 p-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <strong>{BLOCK_LABEL[block.blockType] ?? block.blockType}</strong>
                            <span className="text-gray-500">{n(block.impressions)} показов</span>
                          </div>
                          {actions.length > 0 ? (
                            <div className="mt-2 space-y-1.5 border-t border-gray-200/60 pt-2 text-[12px]">
                              {actions.map((row, index) => (
                                <div key={`${row.label}-${index}`} className="flex justify-between gap-3">
                                  <span className="text-gray-600">{row.label}</span>
                                  <strong className="text-gray-900">{n(row.value)}</strong>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] text-gray-400">Информационный блок — считаются только показы.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
