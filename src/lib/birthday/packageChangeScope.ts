import { z } from "zod";

const money = z.string().regex(/^\d{1,10}\.\d{2}$/);
const price = z.object({ mode: z.enum(["EXACT", "FROM", "ON_REQUEST"]), amountByn: money.nullable() });
const snapshot = z.object({
  id: z.string().nullable().optional(), title: z.string(), category: z.string(),
  refOfferId: z.string().nullable().optional(), isOptional: z.boolean().optional(),
  priceSnapshot: z.string().nullable().optional(), priceDelta: z.string().nullable().optional(),
  removalPolicy: z.string().nullable().optional(), removalCreditByn: z.string().nullable().optional(),
});
export const packageChangeScopeSchema = z.object({
  kind: z.literal("PARTY_PACKAGE_CHANGE"), orderId: z.string(), draftVersion: z.number().int(),
  comment: z.string().nullable().optional(),
  packageId: z.string(), packageTitle: z.string(), originalPrice: price, requestedPrice: price,
  components: z.array(z.object({ itemId: z.string(), snapshot,
    action: z.enum(["KEPT", "REMOVED", "REPLACED"]), creditByn: money,
    requiresQuote: z.boolean(), replacementItemId: z.string().nullable(),
  })).max(60),
  standalone: z.array(z.object({ itemId: z.string(), offerId: z.string().nullable(),
    businessId: z.string().nullable(), title: z.string(), price,
  })).max(30),
});
export type PackageChangeScope = z.infer<typeof packageChangeScopeSchema>;
export function readPackageChangeScope(value: unknown): PackageChangeScope | null {
  const result = packageChangeScopeSchema.safeParse(value);
  return result.success ? result.data : null;
}
