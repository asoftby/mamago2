import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { getMockBirthdayPartyById } from "@/features/me/data/mockUserBirthdays";
import { Container } from "@/components/ui/Container";
import { BirthdayPartyDetailView } from "@/features/me/components/BirthdayPartyDetailView";
import {
  formatPartyDateTime,
  getPartyDisplayTitle,
} from "@/features/me/lib/userBirthdayPartyUi";
import { ArrowLeft } from "lucide-react";

type PageProps = { params: Promise<{ id: string }> };

export default async function MeBirthdayDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const party = getMockBirthdayPartyById(id);
  if (!party) notFound();

  const title = getPartyDisplayTitle(party);
  const dateTimeLine = formatPartyDateTime(party);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-2xl">
        <nav className="mb-8 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/me/birthdays"
            className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Все праздники
          </Link>
          <span className="text-muted-foreground/40" aria-hidden>
            ·
          </span>
          <Link
            href="/me"
            className="font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Профиль
          </Link>
        </nav>

        <BirthdayPartyDetailView
          party={party}
          title={title}
          dateTimeLine={dateTimeLine}
        />
      </Container>
    </div>
  );
}
