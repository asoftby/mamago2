import Link from "next/link";
import type { NormalizedEventImport } from "@/server/modules/import/types";
import type { TelegramQualityFlags } from "@/server/modules/import/normalizers/telegram-post.mapper";
import { lowConfidenceFields, postKindLabel, SOURCE_CHANGE_FIELD_LABEL } from "../../_lib/telegram-review";

const STATE_LABEL: Record<string, { label: string; className: string }> = {
  stated: { label: "указано", className: "bg-emerald-100 text-emerald-900" },
  inferred: { label: "выведено", className: "bg-amber-100 text-amber-900" },
  missing: { label: "нет", className: "bg-gray-100 text-gray-500" },
};

const FIELD_LABEL: Record<string, string> = {
  title: "Название",
  venue: "Площадка",
  address: "Адрес",
  city: "Город",
  age: "Возраст",
  price: "Цена",
  dates: "Даты",
};

const ROLE_LABEL: Record<string, string> = { POSTER: "афиша", PHOTO: "фото", OTHER: "прочее" };

function formatMinsk(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ru-RU", {
    timeZone: "Europe/Minsk",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Pill({ state }: { state: string }) {
  const s = STATE_LABEL[state] ?? STATE_LABEL.missing;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>;
}

/**
 * Карточка ревью для записи из Telegram-канала: что модель взяла из текста и с
 * афиши, где они расходятся, что выведено, а не написано, и возможные дубли.
 * Только для админки: ссылка на пост и картинки источника нигде не публичны.
 */
export function TelegramPostBlock({
  flags,
  nd,
  postUrl,
}: {
  flags: TelegramQualityFlags;
  nd: NormalizedEventImport;
  postUrl: string | null;
}) {
  const low = lowConfidenceFields(flags);
  const sessions = nd.occurrences ?? [];
  const roleByIndex = new Map(flags.imageRoles.map((r) => [r.index, r.role]));
  const changed = flags.sourceChanged;

  return (
    <section className="space-y-4 rounded-lg border border-sky-200 bg-white" data-testid="telegram-post-block">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100 bg-sky-50 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-900">
          Данные из Telegram{postKindLabel(flags.postKind) ? ` · ${postKindLabel(flags.postKind)}` : ""}
        </h2>
        {postUrl && (
          <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
            Открыть пост (только админка)
          </a>
        )}
      </div>

      <div className="space-y-5 px-4 pb-4">
        {changed && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
            <strong>Пост изменился.</strong> Изменено: {changed.fields.map((f) => SOURCE_CHANGE_FIELD_LABEL[f] ?? f).join(", ")}.
            Событие на сайте прежнее: решите, обновлять ли его.
          </div>
        )}

        {flags.hasConflict && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-800">Текст и афиша расходятся</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-1 pr-3 font-medium">Поле</th>
                  <th className="py-1 pr-3 font-medium">В тексте</th>
                  <th className="py-1 font-medium">На афише</th>
                </tr>
              </thead>
              <tbody>
                {flags.conflicts.map((c, i) => (
                  <tr key={`${c.field}-${i}`} className="border-t border-gray-100 align-top">
                    <td className="py-1.5 pr-3 font-mono text-xs text-gray-600">{c.field}</td>
                    <td className="py-1.5 pr-3">{c.text ?? "—"}</td>
                    <td className="py-1.5">
                      {c.image ? `${c.image.value ?? "—"} (картинка ${c.image.index + 1})` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-500">В карточке оставлено значение из текста, проверьте по афише.</p>
          </div>
        )}

        {sessions.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Сеансы ({sessions.length})</h3>
            <ul className="space-y-1 text-sm">
              {sessions.map((s, i) => (
                <li key={s.externalId ?? i} className="flex flex-wrap gap-x-3">
                  <span className="font-medium text-gray-900">{formatMinsk(s.startAt)}</span>
                  {s.title && <span className="text-gray-600">{s.title}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Откуда значения</h3>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {Object.entries(flags.fieldStates).map(([field, state]) => (
              <li key={field} className="flex items-center justify-between gap-2 border-b border-gray-100 py-1">
                <span className="text-gray-700">{FIELD_LABEL[field] ?? field}</span>
                <span className="flex items-center gap-2">
                  {(field === "dates" && low.includes("dates")) || (field === "venue" && low.includes("venue")) ? (
                    <span className="text-xs font-medium text-amber-700">проверить</span>
                  ) : null}
                  <Pill state={state} />
                </span>
              </li>
            ))}
          </ul>
          {flags.audienceHint && <p className="mt-2 text-sm text-gray-700">Подсказка по аудитории: {flags.audienceHint} (возраст не указан)</p>}
          {flags.addressNote && <p className="mt-1 text-sm text-gray-700">К адресу: {flags.addressNote}</p>}
        </div>

        {nd.imageUrls.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Картинки поста</h3>
            <div className="flex flex-wrap gap-2">
              {nd.imageUrls.map((url, i) => (
                <figure key={url} className="w-24">
                  {/* Картинки с CDN источника: без referrer, только в админке. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Картинка ${i + 1}`} referrerPolicy="no-referrer" loading="lazy" className="h-24 w-24 rounded-md border border-gray-200 object-cover" />
                  <figcaption className="mt-0.5 text-center text-xs text-gray-500">
                    {i + 1}{roleByIndex.get(i) ? ` · ${ROLE_LABEL[roleByIndex.get(i)!]}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
            {flags.coverNeedsReplacement && (
              <p className="mt-2 text-xs text-amber-800">
                Обложка временная: картинка чужого канала, перед публикацией её нужно заменить (предпочтительно фото организатора).
              </p>
            )}
          </div>
        )}

        {(flags.pendingDuplicates?.length ?? 0) > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-800">Возможные дубли (ещё не опубликованы)</h3>
            <ul className="space-y-1 text-sm">
              {flags.pendingDuplicates!.map((d) => (
                <li key={d.recordId}>
                  <Link href={`/admin/import/review/${d.recordId}`} className="font-medium text-blue-600 hover:underline">
                    {d.title || d.recordId}
                  </Link>{" "}
                  <span className="text-xs text-gray-500">сходство {Math.round(d.score * 100)}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-gray-500">Это только подсказка: ничего не сливается автоматически.</p>
          </div>
        )}
      </div>
    </section>
  );
}
