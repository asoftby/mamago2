import { Prisma, type PackageComponent } from "@prisma/client";
import { z } from "zod";

const component = z.object({
  id: z.string().min(1).max(128).optional(),
  title: z.string().trim().min(1).max(200),
  category: z.enum(["VENUE", "ANIMATOR", "SHOW", "MASTER_CLASS", "CAKE", "FOOD", "DECOR", "PHOTO", "PROGRAM", "OTHER"]),
  removalPolicy: z.enum(["REQUIRED", "REMOVABLE_NO_REFUND", "REMOVABLE_FIXED_CREDIT", "REMOVABLE_QUOTE_REQUIRED"]).nullable(),
  removalCreditByn: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).nullable(),
}).strict().refine(row => row.removalPolicy === "REMOVABLE_FIXED_CREDIT"
  ? row.removalCreditByn !== null && new Prisma.Decimal(row.removalCreditByn).gt(0)
  : row.removalCreditByn === null, "Укажите положительное уменьшение только для фиксированной политики");

export const packageComponentInputSchema = z.array(component).max(30)
  .refine(rows => new Set(rows.flatMap(row => row.id ? [row.id] : [])).size === rows.filter(row => row.id).length,
    "Повторяющиеся компоненты");
export type PackageComponentInput = z.infer<typeof packageComponentInputSchema>;
export class PackageComponentsError extends Error {}

export function componentRows(rows: Pick<PackageComponent,
  "id" | "title" | "category" | "removalPolicy" | "removalCreditByn">[]): PackageComponentInput {
  return rows.map(row => ({
    id: row.id, title: row.title, category: row.category,
    removalPolicy: row.removalPolicy, removalCreditByn: row.removalCreditByn?.toFixed(2) ?? null,
  }));
}

export function validatePackageCredits(rows: PackageComponentInput, priceMode: string, price: number | null) {
  const credit = rows.reduce((sum, row) => sum.plus(row.removalCreditByn ?? 0), new Prisma.Decimal(0));
  if (credit.gt(0) && (priceMode !== "EXACT" || price === null || credit.gt(new Prisma.Decimal(price)))) {
    throw new PackageComponentsError("Для фиксированного уменьшения нужна точная цена пакета, покрывающая все уменьшения. Иначе выберите согласование.");
  }
}

/** Caller holds the Offer row lock and has checked ownership or moderator permission. */
export async function savePackageComponents(tx: Prisma.TransactionClient, offerId: string,
  input: PackageComponentInput, baseline: PackageComponentInput, allowPublished = false) {
  const rows = packageComponentInputSchema.parse(input);
  const offer = await tx.offer.findUniqueOrThrow({ where: { id: offerId },
    select: { status: true, productType: true, priceFrom: true, priceMode: true } });
  if (offer.productType !== "PARTY_PACKAGE" || (offer.status === "PUBLISHED" && !allowPublished)) {
    throw new PackageComponentsError("Состав опубликованного пакета изменяется через модерацию");
  }
  const existing = await tx.packageComponent.findMany({ where: { packageId: offerId, archivedAt: null },
    orderBy: [{ position: "asc" }, { id: "asc" }] });
  if (JSON.stringify(componentRows(existing)) !== JSON.stringify(baseline)) {
    throw new PackageComponentsError("Состав изменился. Откройте предложение заново");
  }
  const ids = new Set(existing.map(row => row.id));
  if (rows.some(row => row.id && !ids.has(row.id))) throw new PackageComponentsError("Чужой компонент пакета");
  validatePackageCredits(rows, offer.priceMode, offer.priceFrom);
  const retained = rows.flatMap(row => row.id ? [row.id] : []);
  await tx.packageComponent.updateMany({ where: { packageId: offerId, archivedAt: null, id: { notIn: retained } },
    data: { archivedAt: new Date() } });
  for (const [position, row] of rows.entries()) {
    const { id, ...values } = row;
    const data = { ...values, position, removalCreditByn: row.removalCreditByn === null ? null : new Prisma.Decimal(row.removalCreditByn) };
    if (id) await tx.packageComponent.update({ where: { id }, data });
    else await tx.packageComponent.create({ data: { ...data, packageId: offerId } });
  }
}
