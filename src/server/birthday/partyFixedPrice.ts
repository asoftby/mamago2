import { Prisma } from "@prisma/client";

/** R2: AS_REQUESTED at the catalog snapshot price (and not shorter than requested) books at once. */
export function isFixedPriceReply(params: {
  type: string; pricingMode: string; snapshot: Prisma.Decimal | null; priceByn: number;
  replyDurationMinutes?: number | null; orderDurationMinutes: number | null;
}): boolean {
  if (params.type !== "AS_REQUESTED" || params.pricingMode !== "BOOK" || params.snapshot == null) return false;
  if (!new Prisma.Decimal(params.priceByn).equals(params.snapshot)) return false;
  if (params.orderDurationMinutes == null) return true;
  return params.replyDurationMinutes != null && params.replyDurationMinutes >= params.orderDurationMinutes;
}

export function clockMinutes(value: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
