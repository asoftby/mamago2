import { prisma } from "@/lib/prisma";
import { normalizeBrandFont } from "@/lib/typography";

export interface BrandingConfig {
  logoAssetId: string | null;
  faviconAssetId: string | null;
  colorPrimary: string;
  colorAccent: string;
  colorBackground: string;
  colorSurface: string;
  colorText: string;
  fontHeading: string;
  fontBody: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  faviconMimeType: string | null;
  faviconVersion: string | null;
}

const DEFAULTS: BrandingConfig = {
  logoAssetId: null,
  faviconAssetId: null,
  colorPrimary: "#EF8759",
  colorAccent: "#EF8759",
  colorBackground: "#FFFFFF",
  colorSurface: "#FAFAF9",
  colorText: "#1A1410",
  fontHeading: "PT Serif",
  fontBody: "Google Sans",
  logoUrl: null,
  faviconUrl: null,
  faviconMimeType: null,
  faviconVersion: null,
};

export async function getBrandingConfig(): Promise<BrandingConfig> {
  const row = await prisma.brandingConfig.findUnique({
    where: { id: "singleton" },
    include: {
      logoAsset: { select: { publicUrl: true } },
      faviconAsset: {
        select: {
          publicUrl: true,
          mimeType: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!row) return DEFAULTS;

  return {
    logoAssetId: row.logoAssetId,
    faviconAssetId: row.faviconAssetId,
    colorPrimary: row.colorPrimary ?? DEFAULTS.colorPrimary,
    colorAccent: row.colorAccent ?? DEFAULTS.colorAccent,
    colorBackground: row.colorBackground ?? DEFAULTS.colorBackground,
    colorSurface: row.colorSurface ?? DEFAULTS.colorSurface,
    colorText: row.colorText ?? DEFAULTS.colorText,
    fontHeading: normalizeBrandFont(row.fontHeading, "PT Serif"),
    fontBody: normalizeBrandFont(row.fontBody, "Google Sans"),
    logoUrl: row.logoAsset?.publicUrl ?? null,
    faviconUrl: row.faviconAsset?.publicUrl ?? null,
    faviconMimeType: row.faviconAsset?.mimeType ?? null,
    faviconVersion: row.faviconAssetId
      ? [
          row.faviconAssetId,
          row.updatedAt.getTime(),
          row.faviconAsset?.updatedAt.getTime() ?? 0,
        ].join("-")
      : null,
  };
}
