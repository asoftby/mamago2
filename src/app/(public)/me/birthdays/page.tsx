import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { listUserBirthdayParties } from "@/server/services/userBirthdays.service";
import { Container } from "@/components/ui/Container";
import { Surface } from "@/components/ui/surface";
import { H2, BodyMuted } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { peachPrimaryCtaLinkClassName } from "@/lib/peachPrimaryCtaLink";
import { ArrowLeft, PartyPopper } from "lucide-react";
import type { UserBirthdayParty } from "@/features/me/types/userBirthdayParty";
import { sortPartiesForProfile } from "@/features/me/lib/userBirthdayPartyUi";
import { BirthdayPartyCard } from "@/features/me/components/BirthdayPartyCard";
import { getBirthdayBuilderHref } from "@/lib/birthday/getBirthdayBuilderHref";

function isArchived(p: UserBirthdayParty) {
  return p.status === "completed" || p.status === "archived";
}

function isActive(p: UserBirthdayParty) {
  return !isArchived(p);
}

export default async function MeBirthdaysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parties = await listUserBirthdayParties(user.id);
  const sorted = sortPartiesForProfile(parties);
  const active = sorted.filter(isActive);
  const archive = sorted.filter(isArchived);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-4xl">
        <div className="mb-6">
          <Link
            href="/me"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            К профилю
          </Link>
        </div>

        <div className="space-y-2 mb-6">
          <H2>Мои праздники</H2>
          <BodyMuted className="text-sm">
            Черновики, заявки и завершённые дни рождения
          </BodyMuted>
        </div>

        {parties.length === 0 ? (
          <Surface variant="elevated" className="p-8 text-center">
            <BodyMuted className="mb-4">
              Пока нет праздников — создайте сценарий в конструкторе.
            </BodyMuted>
            <Link
              href={getBirthdayBuilderHref()}
              className={cn(peachPrimaryCtaLinkClassName(), "mt-3")}
            >
              <PartyPopper className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 sm:h-[18px] sm:w-[18px]" aria-hidden />
              Создать праздник
            </Link>
          </Surface>
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Активные
                </h3>
                <div className="space-y-2.5">
                  {active.map((p) => (
                    <BirthdayPartyCard key={p.id} party={p} />
                  ))}
                </div>
              </section>
            )}
            {archive.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Архив
                </h3>
                <div className="space-y-2.5">
                  {archive.map((p) => (
                    <BirthdayPartyCard key={p.id} party={p} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}
