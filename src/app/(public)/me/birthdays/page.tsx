import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { listUserBirthdayParties } from "@/server/services/userBirthdays.service";
import { AccountPage } from "@/components/account/AccountPage";
import { Surface } from "@/components/ui/surface";
import { BodyMuted } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { peachPrimaryCtaLinkClassName } from "@/lib/peachPrimaryCtaLink";
import { PartyPopper } from "lucide-react";
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
    <AccountPage
      backHref="/me"
      title="Мои праздники"
      lead="Черновики, заявки и завершённые дни рождения"
    >
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
                <h2 className="text-base font-semibold text-neutral-900">
                  Активные
                </h2>
                <div className="space-y-2.5">
                  {active.map((p) => (
                    <BirthdayPartyCard key={p.id} party={p} />
                  ))}
                </div>
              </section>
            )}
            {archive.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-neutral-900">
                  Архив
                </h2>
                <div className="space-y-2.5">
                  {archive.map((p) => (
                    <BirthdayPartyCard key={p.id} party={p} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
    </AccountPage>
  );
}
