import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { getBrandingConfig } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { BRAND_FONTS } from "@/lib/typography";

export const revalidate = 3600;

export async function GET() {
  const branding = await getBrandingConfig();
  return NextResponse.json(branding);
}

const PatchSchema = z.object({
  logoAssetId: z.string().nullable().optional(),
  faviconAssetId: z.string().nullable().optional(),
  colorPrimary: z.string().nullable().optional(),
  colorAccent: z.string().nullable().optional(),
  colorBackground: z.string().nullable().optional(),
  colorSurface: z.string().nullable().optional(),
  colorText: z.string().nullable().optional(),
  fontHeading: z.enum(BRAND_FONTS).nullable().optional(),
  fontBody: z.enum(BRAND_FONTS).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  await prisma.brandingConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  revalidatePath("/", "layout");

  const branding = await getBrandingConfig();
  return NextResponse.json(branding);
}
