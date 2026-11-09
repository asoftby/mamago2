import Link from "next/link";
import { notFound } from "next/navigation";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";
import { dayTitle, formatTime, pluralPlaces } from "@/features/my-plan/lib/dayScenarioUi/model";
import { getSharedDays } from "@/server/services/dayScenarioEngine/share.service";
import { isDayScenarioEngineEnabled } from "@/server/services/dayScenarioEngine/flag";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

// Capability URL: never indexed, never leaks the token via Referer.
export async function generateMetadata() {
  const base = applyGlobalRobotsOverride({ title: "День от mamaGo" });
  return { ...base, robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}

/** A shared «День от mamaGo» (or its weekend): read-only, no data about who shared it. */
export default async function SharedDayPage({ params }: PageProps) {
  if (!isDayScenarioEngineEnabled()) notFound();
  const { token } = await params;
  const days = await getSharedDays(token);
  if (!days) notFound();
  const weekend = days.length > 1;

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-4 py-8 sm:px-6">
      <p className="m-0 text-[12px] font-semibold uppercase tracking-[.14em] text-[var(--brand-active,#C85F35)]">✦ от mamaGo</p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight">{weekend ? "Выходные" : dayTitle(days[0]!.date)}</h1>
      {days.map((day) => (
        <section key={day.date} aria-label={dayTitle(day.date)} className="mb-8">
          {weekend ? (
            <h2 className="mb-3 text-[19px] font-semibold">
              {dayTitle(day.date)} <span className="text-[14px] font-normal text-neutral-600">· {pluralPlaces(day.points.length)}</span>
            </h2>
          ) : null}
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {day.points.map((point, index) => (
              <li key={`${point.startsAt}-${index}`} className="flex items-start gap-3 rounded-[22px] border border-neutral-200 bg-white p-3">
                <span className="w-[52px] shrink-0 pt-0.5 text-[19px] font-bold tabular-nums">{formatTime(point.startsAt)}</span>
                {point.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote catalog covers
                  <img src={point.coverUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span aria-hidden className="h-16 w-16 shrink-0 rounded-2xl" style={{ background: "linear-gradient(180deg,#F2C8A7,#E89460)" }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[17px] font-semibold leading-snug [overflow-wrap:anywhere]">{point.title}</p>
                  {point.locationText ? <p className="m-0 mt-0.5 text-[14px] text-neutral-600">{point.locationText}</p> : null}
                  {point.suggestedTime ? <p className="m-0 mt-0.5 text-[13px] text-[var(--brand-active,#C85F35)]">время подобрано, уточните</p> : null}
                  {point.href ? (
                    <Link href={point.href} className="mt-1 inline-block text-[14px] font-semibold text-[var(--brand-active,#C85F35)] underline-offset-2 hover:underline">
                      {point.kind === "event" ? "Открыть в афише" : "Страница места"}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <p className="mt-8 text-center text-sm text-neutral-600">
        Хотите так же?{" "}
        <Link href="/" className="font-semibold text-[var(--brand-active,#C85F35)] hover:underline">
          Собрать свой день
        </Link>
      </p>
    </main>
  );
}
