import { prisma } from "@/lib/prisma";

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
}

const DEFAULTS: BrandingConfig = {
  logoAssetId: null,
  faviconAssetId: null,
  colorPrimary: "#EF8759",
  colorAccent: "#EF8759",
  colorBackground: "#FFFFFF",
  colorSurface: "#FAFAF9",
  colorText: "#1A1410",
  fontHeading: "NTSomic",
  fontBody: "NTSomic",
  logoUrl: null,
  faviconUrl: null,
};

export async function getBrandingConfig(): Promise<BrandingConfig> {
  const row = await prisma.brandingConfig.findUnique({
    where: { id: "singleton" },
    include: {
      logoAsset: { select: { publicUrl: true } },
      faviconAsset: { select: { publicUrl: true } },
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
    fontHeading: row.fontHeading ?? DEFAULTS.fontHeading,
    fontBody: row.fontBody ?? DEFAULTS.fontBody,
    logoUrl: row.logoAsset?.publicUrl ?? null,
    faviconUrl: row.faviconAsset?.publicUrl ?? null,
  };
}
