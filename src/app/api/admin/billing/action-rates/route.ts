import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  type BillingActionPricingType,
  type BillingActionType,
  type BillingRateScopeType,
} from "@prisma/client";
import {
  createBusinessBillingActionRate,
  ensureDefaultBillingActionRates,
  getBusinessResolvedBillingActionPrices,
  listBillingActionRates,
  upsertGlobalBillingActionRate,
} from "@/server/services/billing/billingActionRateResolver.service";

function parseNullableNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureDefaultBillingActionRates(user.id);

  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");

  const [globalRates, businessRates, resolvedPrices] = await Promise.all([
    listBillingActionRates({
      scopeType: "GLOBAL",
      includeInactive: true,
    }),
    businessId
      ? listBillingActionRates({
          scopeType: "BUSINESS",
          scopeId: businessId,
          includeInactive: true,
        })
      : Promise.resolve([]),
    businessId
      ? getBusinessResolvedBillingActionPrices({ businessId })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    success: true,
    globalRates,
    businessRates,
    resolvedPrices,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const scopeType = (formData.get("scopeType") as BillingRateScopeType | null) ?? "GLOBAL";
  const actionType = formData.get("actionType") as BillingActionType | null;
  const pricingType = formData.get("pricingType") as BillingActionPricingType | null;

  if (!actionType || !pricingType) {
    return NextResponse.json({ error: "actionType and pricingType are required" }, { status: 400 });
  }

  const common = {
    actionType,
    pricingType,
    fixedAmount: parseNullableNumber(formData.get("fixedAmount")),
    percentRate: parseNullableNumber(formData.get("percentRate")),
    minimumAmount: parseNullableNumber(formData.get("minimumAmount")),
    maximumAmount: parseNullableNumber(formData.get("maximumAmount")),
    currency: (formData.get("currency") as string | null) ?? "BYN",
    isActive: formData.get("isActive") === "true",
    startsAt: parseNullableDate(formData.get("startsAt")),
    endsAt: parseNullableDate(formData.get("endsAt")),
    reason: (formData.get("reason") as string | null) ?? null,
    createdById: user.id,
  };

  if (scopeType === "BUSINESS") {
    const businessId = formData.get("businessId");
    if (typeof businessId !== "string" || !businessId) {
      return NextResponse.json({ error: "businessId is required for BUSINESS scope" }, { status: 400 });
    }

    const rate = await createBusinessBillingActionRate({
      businessId,
      ...common,
    });

    return NextResponse.json({ success: true, rate });
  }

  const rate = await upsertGlobalBillingActionRate(common);
  return NextResponse.json({ success: true, rate });
}
