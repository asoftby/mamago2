import { NextRequest, NextResponse } from "next/server";
import { OfferProductType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { listOfferCategories } from "@/server/offers/offerCategories";

export const runtime = "nodejs";

/** GET /api/business/offer-categories?productType=PARTY_PACKAGE — категории для шага «Что предлагаете». */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("productType");
  const productType = (Object.values(OfferProductType) as string[]).includes(raw ?? "")
    ? (raw as OfferProductType)
    : null;
  if (!productType) {
    return NextResponse.json({ error: "Invalid productType" }, { status: 400 });
  }

  const categories = await listOfferCategories(prisma, productType);
  return NextResponse.json({ categories });
}
