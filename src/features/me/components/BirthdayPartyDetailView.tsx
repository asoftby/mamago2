import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import type { UserBirthdayPartyDetail } from "@/features/me/types/userBirthdayParty";
import { getConfirmationProgressUi } from "@/features/me/lib/userBirthdayPartyUi";
import { BirthdayPartyDayPlan } from "@/features/me/components/BirthdayPartyDayPlan";
import { cn } from "@/lib/utils";

type BirthdayPartyDetailViewProps = {
  party: UserBirthdayPartyDetail;
  title: string;
  /** «12 мая 2025 • 15:00–17:00» */
  dateTimeLine: string | null;
};

export function BirthdayPartyDetailView({
  party,
  title,
  dateTimeLine,
}: BirthdayPartyDetailViewProps) {
  const isDraft = party.status === "draft";
  const progress = !isDraft ? getConfirmationProgressUi(party) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {dateTimeLine ? (
          <p className="text-sm text-muted-foreground tabular-nums">{dateTimeLine}</p>
        ) : isDraft ? (
          <p className="text-sm text-muted-foreground">Дата и время уточняются</p>
        ) : null}
      </header>

      {!isDraft && progress ? (
        <Surface variant="elevated" className="p-4 sm:p-5">
          <div className="space-y-2">
            <div
              className={cn(
                "h-1 w-full rounded-full overflow-hidden",
                progress.trackClass,
              )}
              role="progressbar"
              aria-valuenow={progress.fillPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full min-w-0 transition-[width] duration-300",
                  progress.fillClass,
                )}
                style={{ width: `${progress.fillPct}%` }}
              />
            </div>
            <p
              className={cn(
                "text-sm font-medium tabular-nums",
                progress.labelClass,
              )}
            >
              {progress.label}
            </p>
          </div>
        </Surface>
      ) : isDraft ? (
        <Surface variant="elevated" className="p-4 sm:p-5">
          <p className="text-sm font-medium text-neutral-600">Черновик</p>
          <p className="text-xs text-muted-foreground mt-1">
            Завершите настройку и отправьте заявку — здесь появится план и прогресс
            согласования.
          </p>
        </Surface>
      ) : null}

      {!isDraft && (
        <BirthdayPartyDayPlan
          partyTitle={title}
          dateTimeLine={dateTimeLine}
          organizers={party.organizers}
          partyId={party.id}
        />
      )}

      <section className="space-y-2 pt-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Действия
        </h2>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          {isDraft ? (
            <Button asChild className="h-11 w-full sm:w-auto">
              <Link href="/birthday">Продолжить настройку</Link>
            </Button>
          ) : (
            <>
              <Button variant="outline" className="h-11 w-full sm:w-auto" asChild>
                <Link href="/birthday">Изменить праздник</Link>
              </Button>
              <Button variant="outline" className="h-11 w-full sm:w-auto" asChild>
                <Link href="/birthday">Добавить услугу</Link>
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
