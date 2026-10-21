import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { readPartyOrder } from "@/server/birthday/partyDraft.service";
import { PartyApiError } from "@/server/birthday/partyDraft.validation";
import {
  PartyOrderStatusScreen, type PartyOrderScreenData,
} from "@/features/me/components/PartyOrderStatusScreen";

type PageProps = { params: Promise<{ id: string }> };

export default async function MeBirthdayDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  let party: Awaited<ReturnType<typeof readPartyOrder>>;
  try {
    party = await readPartyOrder(user.id, id);
  } catch (error) {
    if (error instanceof PartyApiError && error.status === 404) notFound();
    throw error;
  }
  const normalized: PartyOrderScreenData = {
    id: party.id,
    childName: party.childName || "ребёнка",
    status: party.status,
    date: party.eventDate?.toISOString().slice(0, 10) ?? null,
    time: party.timeFrom && party.timeTo ? `${party.timeFrom}–${party.timeTo}` : party.timeFrom,
    items: party.items.map((item) => {
      const request = item.requests[0];
      const quote = request?.partyQuotes[0];
      return {
        id: item.id, title: item.offer?.title ?? item.category,
        role: item.role, status: item.status,
        request: request ? {
          id: request.id, partyStage: request.partyStage,
          quote: quote ? {
            id: quote.id, version: quote.version, status: quote.status,
            priceByn: quote.priceByn?.toString() ?? null,
            includes: quote.includes, prepaymentTerms: quote.prepaymentTerms,
            cancellationTerms: quote.cancellationTerms,
            validUntil: quote.validUntil?.toISOString() ?? null,
            canAccept: request.partyStage === "QUOTED" && quote.status === "ACTIVE" &&
              Boolean(quote.validUntil && quote.validUntil > new Date()),
          } : null,
        } : null,
      };
    }),
  };
  return <PartyOrderStatusScreen party={normalized} />;
}
