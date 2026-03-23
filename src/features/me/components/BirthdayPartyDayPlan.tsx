"use client";

import { useEffect, useMemo, useState } from "react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { BodyMuted } from "@/components/ui/typography";
import type { UserBirthdayPartyOrganizer } from "@/features/me/types/userBirthdayParty";
import {
  getOrganizerStatusLabel,
  getOrganizerStatusToneClass,
} from "@/features/me/lib/birthdayPartyDetailUi";
import {
  getOrganizerDialogHref,
  getOrganizerTelHref,
  shouldShowCallButton,
  shouldShowDialogButton,
  sortOrganizersByTimeline,
} from "@/features/me/lib/birthdayPartyDayPlan";
import {
  appendSharePlanLinkFooter,
  buildBirthdayPartyShareText,
  buildPublicPlanPath,
} from "@/features/me/lib/buildBirthdayPartyShareText";
import { BirthdayPartyShareModal } from "@/features/me/components/BirthdayPartyShareModal";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BirthdayPartyDayPlanProps = {
  partyTitle: string;
  dateTimeLine: string | null;
  organizers: UserBirthdayPartyOrganizer[];
  partyId: string;
};

function buildOriginShareUrl(partyId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${buildPublicPlanPath(partyId)}`;
}

export function BirthdayPartyDayPlan({
  partyTitle,
  dateTimeLine,
  organizers,
  partyId,
}: BirthdayPartyDayPlanProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const sorted = sortOrganizersByTimeline(organizers);

  useEffect(() => {
    setShareUrl(buildOriginShareUrl(partyId));
  }, [partyId]);

  const shareText = useMemo(
    () =>
      buildBirthdayPartyShareText({
        partyTitle,
        dateTimeLine,
        organizers,
      }),
    [partyTitle, dateTimeLine, organizers],
  );

  const fullShareBody = useMemo(() => {
    if (!shareUrl) return shareText;
    return appendSharePlanLinkFooter(shareText, shareUrl);
  }, [shareText, shareUrl]);

  /** Всегда открываем модалку. Раньше при наличии navigator.share сразу вызывался системный шит
   * (Safari/iOS) и модалка не показывалась; при отмене шита — тоже. Нативный share — в модалке. */
  const handleShare = () => {
    setShareOpen(true);
  };

  return (
    <section className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          План праздника
        </h2>
        {sorted.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 self-start sm:self-center"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 mr-1.5" aria-hidden />
            Поделиться планом
          </Button>
        ) : null}
      </div>

      <BirthdayPartyShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareTitle={`Праздник: ${partyTitle}`}
        shareFullText={fullShareBody || shareText}
        shareUrl={shareUrl || buildOriginShareUrl(partyId)}
      />

      {sorted.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden shadow-sm">
          <ul className="divide-y divide-border/60">
            {sorted.map((o) => {
              const tel = getOrganizerTelHref(o);
              const dialog = getOrganizerDialogHref(o);
              const time = o.timeLabel?.trim() || "—";
              return (
                <li key={o.id} className="px-4 py-3.5 sm:px-5 sm:py-4">
                  <div className="flex flex-col gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        <span className="text-muted-foreground tabular-nums">{time}</span>
                        {" — "}
                        {o.roleTitle}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">{o.businessName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex text-xs font-medium px-2 py-0.5 rounded-md",
                          getOrganizerStatusToneClass(o.confirmation),
                        )}
                      >
                        {getOrganizerStatusLabel(o.confirmation)}
                      </span>
                      {shouldShowCallButton(o.confirmation) && tel ? (
                        <Button variant="outline" size="sm" className="h-8" asChild>
                          <a href={tel}>Позвонить</a>
                        </Button>
                      ) : null}
                      {shouldShowDialogButton(o.confirmation) && dialog ? (
                        <Button variant="outline" size="sm" className="h-8" asChild>
                          <a href={dialog} target="_blank" rel="noopener noreferrer">
                            Открыть диалог
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <Surface variant="elevated" className="p-4 sm:p-5">
          <BodyMuted className="text-sm">
            План появится после отправки заявок организаторам.
          </BodyMuted>
        </Surface>
      )}
    </section>
  );
}
