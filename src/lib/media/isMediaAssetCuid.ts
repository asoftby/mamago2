/** Клиент и сервер: эвристика для Prisma cuid у MediaAsset. */
export function isMediaAssetCuid(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return /^c[a-z0-9]{24,25}$/i.test(value);
}
