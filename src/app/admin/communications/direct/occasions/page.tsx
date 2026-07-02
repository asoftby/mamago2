import Link from "next/link";
import { PublicationType } from "@prisma/client";
import { adminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";
import { getAdminOccasions, type AdminOccasionFilter } from "@/server/services/direct/directAdmin.service";
import { ThreadNumber } from "@/components/direct/ThreadNumber";
import { DialogSearchForm } from "../dialogs/DialogSearchForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FILTERS: { key: AdminOccasionFilter; label: string }[] = [
  { key: "ALL", label: "Все" },
  { key: "NEW", label: "Новые" },
  { key: "ACTIVE", label: "В работе" },
  { key: "COMPLETED", label: "Завершённые" },
  { key: "BLOCKED", label: "Заблокированные" },
  { key: "ARCHIVE", label: "Архив" },
];

const PUBLICATION_LABELS: Record<PublicationType, string> = {
  OFFER: "Предложение",
  EVENT: "Событие",
  PLACE: "Место",
};

const BASE_PATH = adminPath("/communications/direct/occasions");
const DIALOGS_PATH = adminPath("/communications/direct/dialogs");

export default async function AdminDirectOccasionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; publicationType?: string; q?: string }>;
}) {
  const params = await searchParams;
  const filter = (FILTERS.some((f) => f.key === params.filter) ? params.filter : "ALL") as AdminOccasionFilter;
  const publicationType = (Object.values(PublicationType) as string[]).includes(params.publicationType ?? "")
    ? (params.publicationType as PublicationType)
    : undefined;
  const search = params.q;

  const occasions = await getAdminOccasions(filter, publicationType, search);

  const query = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { filter, publicationType, q: search, ...overrides };
    if (merged.filter && merged.filter !== "ALL") next.set("filter", merged.filter);
    if (merged.publicationType) next.set("publicationType", merged.publicationType);
    if (merged.q) next.set("q", merged.q);
    const qs = next.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={query({ filter: f.key })}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                filter === f.key
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <DialogSearchForm basePath={BASE_PATH} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={query({ publicationType: undefined })}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            !publicationType ? "bg-stone-800 text-white" : "bg-stone-50 text-stone-500 hover:bg-stone-100",
          )}
        >
          Все типы
        </Link>
        {Object.values(PublicationType).map((pt) => (
          <Link
            key={pt}
            href={query({ publicationType: pt })}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              publicationType === pt ? "bg-stone-800 text-white" : "bg-stone-50 text-stone-500 hover:bg-stone-100",
            )}
          >
            {PUBLICATION_LABELS[pt]}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Повод</th>
              <th className="px-4 py-3">Бизнес</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Бакет</th>
              <th className="px-4 py-3">Последнее сообщение</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {occasions.map((o) => (
              <tr key={o.threadId} className="hover:bg-stone-50/60">
                <td className="px-4 py-3">
                  <ThreadNumber value={o.threadNumber} /> · {o.publicationTitle}
                </td>
                <td className="px-4 py-3 text-stone-700">{o.businessName}</td>
                <td className="px-4 py-3 text-stone-700">{o.customerName}</td>
                <td className="px-4 py-3 text-stone-500">{PUBLICATION_LABELS[o.publicationType]}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    {o.filterBucket}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-500">
                  <span className="max-w-xs truncate">{o.lastMessagePreview ?? "—"}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${DIALOGS_PATH}/${o.threadId}`}
                    className="text-sm font-medium text-stone-900 underline underline-offset-2"
                  >
                    Открыть диалог
                  </Link>
                </td>
              </tr>
            ))}
            {occasions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
