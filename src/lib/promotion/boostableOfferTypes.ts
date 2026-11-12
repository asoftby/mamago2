/**
 * A Boost can only raise Offers in the currently ranked classes catalog.
 * Other product types need a dedicated discovery integration before launch.
 * Null keeps legacy SERVICE Offers visible for existing businesses.
 */
export function isBoostableOfferProductType(
  kind: string,
  productType: string | null,
): boolean {
  return kind === "SERVICE" &&
    (productType == null ||
      productType === "ONE_TIME_ACTIVITY" ||
      productType === "REGULAR_ACTIVITY");
}
