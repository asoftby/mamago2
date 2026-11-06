import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { PartyWizardInputError, type packageComponentInputSchema } from "@/lib/offers/partyWizardInput";

/** Called inside the offer transaction after its ownership/publication checks. No price/removal policy. */
export async function savePackageComponents(tx: Prisma.TransactionClient, offerId: string,
  rows: z.infer<typeof packageComponentInputSchema>, baseline?: z.infer<typeof packageComponentInputSchema>, initial = false, targetProductType?: string) {
  await tx.$queryRaw`SELECT "id" FROM "Offer" WHERE "id" = ${offerId} FOR UPDATE`;
  const offer = await tx.offer.findUniqueOrThrow({ where: { id: offerId }, select: { productType: true, status: true } });
  const existing = await tx.packageComponent.findMany({ where: { packageId: offerId, archivedAt: null }, orderBy: { position: "asc" },
    select: { id: true, title: true, category: true } });
  const same = existing.length === rows.length && existing.every((c, i) => c.id === rows[i].id && c.title === rows[i].title && c.category === rows[i].category);
  if (same) return;
  if (baseline === undefined || JSON.stringify(existing.map(c => ({ id: c.id, title: c.title, category: c.category }))) !== JSON.stringify(baseline)) throw new PartyWizardInputError("Состав изменился. Откройте предложение заново");
  if ((targetProductType ?? offer.productType) !== "PARTY_PACKAGE" || (!initial && offer.status === "PUBLISHED"))
    throw new PartyWizardInputError("Изменение состава доступно в черновике пакета; опубликованный пакет требует согласования");
  const ids = new Set(existing.map(c => c.id));
  if (rows.some(r => r.id && !ids.has(r.id))) throw new PartyWizardInputError("Компонент не принадлежит пакету");
  const retained = new Set(rows.flatMap(r => r.id ? [r.id] : []));
  const removed = existing.filter(c => !retained.has(c.id));
  if (removed.length) await tx.packageComponent.updateMany({ where: { packageId: offerId, id: { in: removed.map(c => c.id) } }, data: { archivedAt: new Date() } });
  for (const [position, row] of rows.entries()) {
    if (row.id) await tx.packageComponent.update({ where: { id: row.id }, data: { title: row.title, category: row.category, position } });
    else await tx.packageComponent.create({ data: { packageId: offerId, title: row.title, category: row.category, position } });
  }
}
