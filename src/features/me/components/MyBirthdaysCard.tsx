"use client";

import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { H2, BodyMuted } from "@/components/ui/typography";
import { PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { peachPrimaryCtaLinkClassName } from "@/lib/peachPrimaryCtaLink";
import { getBirthdayBuilderHref } from "@/lib/birthday/getBirthdayBuilderHref";
import type { UserBirthdayParty } from "@/features/me/types/userBirthdayParty";
import { takePreviewParties } from "@/features/me/lib/userBirthdayPartyUi";
import { BirthdayPartyCard } from "./BirthdayPartyCard";

type MyBirthdaysCardProps = {
  parties: UserBirthdayParty[];
};

export function MyBirthdaysCard({ parties }: MyBirthdaysCardProps) {
  const preview = takePreviewParties(parties, 3);
  const hasParties = parties.length > 0;

  return (
    <Surface variant="elevated" className="p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <PartyPopper className="h-5 w-5 text-primary shrink-0" aria-hidden />
          <H2 className="truncate">Мои праздники</H2>
        </div>
        {hasParties && (
          <Link
            href="/me/birthdays"
            className="text-sm font-medium text-primary hover:text-primary/85 whitespace-nowrap inline-flex items-center gap-0.5"
          >
            Смотреть все
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>

      {hasParties ? (
        <div className="space-y-2.5">
          {preview.map((p) => (
            <BirthdayPartyCard key={p.id} party={p} compact />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-6 text-center">
          <BodyMuted className="mb-4 max-w-md mx-auto text-sm">
            Здесь появятся черновики и отправленные заявки на дни рождения.
          </BodyMuted>
          <Link
            href={getBirthdayBuilderHref()}
            className={cn(peachPrimaryCtaLinkClassName(), "mt-3")}
          >
            <PartyPopper className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 sm:h-[18px] sm:w-[18px]" aria-hidden />
            Создать праздник
          </Link>
        </div>
      )}
    </Surface>
  );
}
