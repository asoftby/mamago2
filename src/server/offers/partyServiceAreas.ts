import type { Prisma } from "@prisma/client";
import { PartyWizardInputError } from "@/lib/offers/partyWizardInput";
import { partyServiceAreas } from "@/lib/offers/offer-types/details-schemas";

export async function validatePartyServiceAreas(db: Prisma.TransactionClient, details: Record<string, unknown> | null | undefined) {
  if (details?.serviceAreas === undefined) return;
  const parsed = partyServiceAreas.safeParse(details.serviceAreas);
  if (!parsed.success) throw new PartyWizardInputError("Проверьте города обслуживания");
  const ids = [...new Set([...parsed.data.travel, ...parsed.data.delivery])];
  if (!ids.length) return;
  const count = await db.territory.count({ where: { id: { in: ids }, type: "CITY", isActive: true } });
  if (count !== ids.length) throw new PartyWizardInputError("Выберите города из списка");
}
