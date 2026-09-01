import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { id } = await params;
  const place = await prisma.place.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      createdByUserId: true,
      ownerBusinessId: true,
      formattedAddr: true,
      customAddress: true,
      phone: true,
      phoneLabel: true,
      phone2: true,
      phone2Label: true,
      phone3: true,
      phone3Label: true,
      website: true,
      instagramUrl: true,
    },
  });

  if (!place || !(await canManagePlaceAsync(user, place))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const socialLinks = [place.instagramUrl]
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    .map((url, index) => ({ id: `place-social-${index}`, network: "instagram" as const, url }));

  return NextResponse.json({
    id: place.id,
    title: place.title,
    address: place.formattedAddr ?? place.customAddress ?? "",
    phone: place.phone ?? "",
    phoneLabel: place.phoneLabel ?? "",
    phone2: place.phone2 ?? "",
    phone2Label: place.phone2Label ?? "",
    phone3: place.phone3 ?? "",
    phone3Label: place.phone3Label ?? "",
    website: place.website ?? "",
    socialLinks,
  });
}
