import { prisma } from "@/lib/prisma";
import { resolveFamilyScope, familyReadsEnabled } from "@/server/family/familyAccess";
import { readFamilyPartyProgramme } from "@/server/birthday/partyPlan.service";
import { projectProgramme, programmeEntries } from "@/lib/birthday/partyProgramme";
import { BirthdayPartyDayPlan } from "@/features/me/components/BirthdayPartyDayPlan";
import { PartyProgrammeEditor, type ProgrammeEditorData } from "@/features/me/components/PartyProgrammeEditor";
import { readPackageChangeScope } from "@/lib/birthday/packageChangeScope";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { readPartyOrder } from "@/server/birthday/partyDraft.service";
import { PartyApiError } from "@/server/birthday/partyDraft.validation";
import { partyCancelBlocker } from "@/server/birthday/partyCancelRules";
import { wishlistEnabled } from "@/server/wishlist/wishlistPure";
import { partyGiftsHref } from "@/features/wishlist/lib/wishlistView";
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
    if (error instanceof PartyApiError && error.status === 404) {
      const programme = await readFamilyPartyProgramme(user.id, id);
      if (!programme) notFound();
      return <div className="mx-auto max-w-3xl space-y-6 px-4 py-8"><h1 className="font-editorial text-3xl">Семейный праздник</h1><BirthdayPartyDayPlan programme={programme} /></div>;
    }
    throw error;
  }
  const scope = familyReadsEnabled() ? await resolveFamilyScope(user.id) : null;
  const [members, children] = scope?.familyId ? await Promise.all([
    prisma.familyMembership.findMany({ where: { familyId: scope.familyId, leftAt: null, userId: { not: user.id } },
      select: { userId: true, user: { select: { displayName: true } } }, take: 20 }),
    prisma.child.findMany({ where: { familyId: scope.familyId }, select: { id: true, name: true }, take: 30 }),
  ]) : [[], []];
  const overrides = programmeEntries(party.programme);
  const positions = new Map(overrides.map((entry, index) => [entry.itemId, index]));
  const orderedItems = [...party.items].sort((a, b) =>
    (positions.get(a.id) ?? overrides.length + a.position) - (positions.get(b.id) ?? overrides.length + b.position));
  const editor: ProgrammeEditorData = {
    id: party.id, version: party.version, cancelled: party.status === "CANCELLED", programme: projectProgramme(party),
    entries: orderedItems.map(item => overrides.find(row => row.itemId === item.id) ?? { itemId: item.id, from: null, to: null }),
    adultIds: party.programmeAdultIds, childIds: party.programmeChildIds, inPlan: Boolean(party.planItemId),
    adults: members.map(row => ({ id: row.userId, label: row.user.displayName || "Взрослый участник" })),
    children: children.map(row => ({ id: row.id, label: row.name || "Профиль ребёнка" })),
    publicPath: party.status !== "CANCELLED" && party.publicPlanToken && party.publicPlanExpiresAt && party.publicPlanExpiresAt > new Date() ? `/p/${party.publicPlanToken}` : null,
    expiresAt: party.publicPlanExpiresAt?.toISOString() ?? null,
  };
  const normalized: PartyOrderScreenData = {
    id: party.id,
    childName: party.childName || "ребёнка",
    status: party.status,
    version: party.version,
    cancelBlocker: partyCancelBlocker(party),
    date: party.eventDate?.toISOString().slice(0, 10) ?? null,
    time: party.timeFrom && party.timeTo ? `${party.timeFrom}–${party.timeTo}` : party.timeFrom,
    giftsHref: wishlistEnabled()
      ? partyGiftsHref(party.childName || "ребёнка", party.eventDate?.toISOString().slice(0, 10) ?? null)
      : null,
    items: party.items.map((item) => {
      const request = item.requests[0];
      const quote = request?.partyQuotes[0];
      return {
        id: item.id, title: item.offer?.title ?? item.category,
        role: item.role, status: item.status,
        request: request ? {
          id: request.id, partyStage: request.partyStage, packageScope: readPackageChangeScope(request.bookingPriceSnapshot),
          quote: quote ? {
            id: quote.id, version: quote.version, status: quote.status,
            priceByn: quote.priceByn?.toString() ?? null,
            declineReason: quote.declineReason, declineComment: quote.declineComment, changeReason: quote.changeReason, includes: quote.includes, prepaymentTerms: quote.prepaymentTerms,
            cancellationTerms: quote.cancellationTerms,
            validUntil: quote.validUntil?.toISOString() ?? null,
            canAccept: request.partyStage === "QUOTED" && quote.status === "ACTIVE" &&
              Boolean(quote.validUntil && quote.validUntil > new Date()),
          } : null,
        } : null,
      };
    }),
  };
  return <PartyOrderStatusScreen party={normalized}><PartyProgrammeEditor key={`${party.id}:${party.version}`} data={editor} /></PartyOrderStatusScreen>;
}
