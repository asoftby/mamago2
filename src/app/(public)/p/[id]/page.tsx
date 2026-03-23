import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { getMockBirthdayPartyById } from "@/features/me/data/mockUserBirthdays";
import {
  formatPartyDateTime,
  getPartyDisplayTitle,
} from "@/features/me/lib/userBirthdayPartyUi";
import {
  getOrganizerTelHref,
  sortOrganizersByTimeline,
} from "@/features/me/lib/birthdayPartyDayPlan";
import { formatTelForShare } from "@/features/me/lib/buildBirthdayPartyShareText";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const party = getMockBirthdayPartyById(id);
  if (!party) return { title: "План праздника" };
  const title = getPartyDisplayTitle(party);
  return {
    title: `${title} — план`,
    description: "План дня и контакты исполнителей",
  };
}

export default async function PublicBirthdayPlanPage({ params }: PageProps) {
  const { id } = await params;
  const party = getMockBirthdayPartyById(id);
  if (!party) notFound();

  const title = getPartyDisplayTitle(party);
  const dateTimeLine = formatPartyDateTime(party);
  const sorted = sortOrganizersByTimeline(party.organizers);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-lg">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-4">
          План праздника
        </p>
        <header className="space-y-1 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {dateTimeLine ? (
            <p className="text-sm text-muted-foreground tabular-nums">{dateTimeLine}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Дата и время уточняются</p>
          )}
        </header>

        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <ul className="divide-y divide-border/60">
            {sorted.map((o) => {
              const tel = getOrganizerTelHref(o);
              const time = o.timeLabel?.trim() || "—";
              return (
                <li key={o.id} className="px-4 py-4 sm:px-5">
                  <p className="text-sm font-semibold text-foreground">
                    <span className="text-muted-foreground tabular-nums">{time}</span>
                    {" — "}
                    {o.roleTitle}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{o.businessName}</p>
                  {tel ? (
                    <p className="text-sm text-foreground mt-2 tabular-nums">
                      📞 {formatTelForShare(tel)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          <Link href="/" className="underline underline-offset-2 hover:text-foreground">
            Mamago
          </Link>
        </p>
      </Container>
    </div>
  );
}
