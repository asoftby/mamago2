import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { listPlanItemsByDate } from "@/server/services/plan.service";
import { Container } from "@/components/ui/Container";
import { CalendarDays, ExternalLink } from "lucide-react";
import { getPlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import { publicActivityPath } from "@/lib/business/eventPublicLink";

type PageProps = {
  params: Promise<{ date: string }>;
};

function formatTime(dt: Date | null): string | null {
  if (!dt) return null;
  return new Date(dt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default async function DayPage({ params }: PageProps) {
  const { date } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/me/plan");

  const items = await listPlanItemsByDate(user.id, date);

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-2xl">
        <div className="mb-6">
          <Link href="/me/plan" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
            ← Мой план
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1 capitalize">{dateLabel}</h1>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
              <CalendarDays className="w-6 h-6 text-neutral-400" />
            </div>
            <p className="text-base font-semibold text-neutral-900">На этот день ничего нет</p>
            <p className="text-sm text-neutral-500 mt-1 mb-6">Добавьте активности в план</p>
            <Link href="/minsk" className="px-5 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors">
              Найти активности
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const time = formatTime(item.startsAt);
              const title = item.activity?.title ?? item.title ?? "Активность";
              const image = item.activity?.coverImageUrl ?? item.coverImageUrl ?? null;
              const availability = getPlanActivityPublicAvailability(item.activity);
              const unavailable =
                availability === "business_disabled" || availability === "missing_activity";
              return (
                <div key={item.id} className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white">
                  <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {index + 1}
                  </div>

                  {item.activity?.coverImageUrl ?? item.coverImageUrl ? (
                    <img src={image!} alt={title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-neutral-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 leading-tight line-clamp-1">{title}</p>
                    {unavailable && (
                      <p className="text-xs text-amber-700 mt-0.5">Снято с публикации</p>
                    )}
                    {time && <p className="text-xs text-neutral-500 mt-0.5">{time}</p>}
                    {item.activity?.ageLabel && (
                      <p className="text-xs text-neutral-400 mt-0.5">{item.activity.ageLabel}</p>
                    )}
                  </div>

                  {item.activityId && !unavailable && (
                    <Link
                      href={publicActivityPath(item.activityId, "minsk", item.activity?.slug)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
