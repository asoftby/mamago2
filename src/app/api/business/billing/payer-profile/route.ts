import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { billingPayerInputSchema } from "@/lib/validation/billingPayerProfile";

async function ownerBusinessId() {
  const user = await getCurrentUser();
  if (!user) return null;
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id }, select: { id: true },
  });
  return business?.id ?? null;
}

export async function GET() {
  const businessId = await ownerBusinessId();
  if (!businessId) return NextResponse.json({ error: "Business owner access required" }, { status: 403 });
  const profile = await prisma.billingPayerProfile.findUnique({ where: { businessId } });
  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const businessId = await ownerBusinessId();
  if (!businessId) return NextResponse.json({ error: "Business owner access required" }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = billingPayerInputSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payer details", details: parsed.error.flatten() }, { status: 400 });
  const profile = await prisma.billingPayerProfile.upsert({
    where: { businessId },
    create: { businessId, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ profile });
}
