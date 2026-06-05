import prisma from "@/lib/prisma";
import {
  Prisma,
  type BillingActionRate,
  type BillingActionPricingType,
  type BillingActionType,
  type BillingRateScopeType,
} from "@prisma/client";

const BILLING_ACTION_TYPES: BillingActionType[] = [
  "LEAD_CREATED",
  "BOOKING_CONFIRMED",
  "CONTACT_OPENED",
  "VISIT_CONFIRMED",
];

export const DEFAULT_BILLING_ACTION_RULES: Record<
  BillingActionType,
  {
    pricingType: BillingActionPricingType;
    fixedAmount?: number;
    percentRate?: number;
    minimumAmount?: number;
    maximumAmount?: number;
    reason: string;
    isActive: boolean;
  }
> = {
  LEAD_CREATED: {
    pricingType: "FIXED",
    fixedAmount: 20,
    reason: "MVP: фиксированная стоимость заявки",
    isActive: true,
  },
  BOOKING_CONFIRMED: {
    pricingType: "PERCENT_WITH_MINIMUM",
    percentRate: 10,
    minimumAmount: 30,
    reason: "Шаблон для будущей тарификации подтверждённых заказов",
    isActive: false,
  },
  CONTACT_OPENED: {
    pricingType: "FREE",
    reason: "По умолчанию бесплатно",
    isActive: false,
  },
  VISIT_CONFIRMED: {
    pricingType: "FREE",
    reason: "По умолчанию бесплатно",
    isActive: false,
  },
};

export class MissingBaseAmountForPercentRateError extends Error {
  constructor() {
    super("Base amount is required for percent pricing");
    this.name = "MissingBaseAmountForPercentRateError";
  }
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function normalizeAmount(value: number) {
  return Number(value.toFixed(2));
}

function getBillingActionRateDelegate() {
  return (prisma as typeof prisma & {
    billingActionRate?: typeof prisma.billingActionRate;
  }).billingActionRate;
}

function isMissingBillingActionRateTableError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return (
    error.code === "P2021" &&
    typeof error.message === "string" &&
    error.message.includes("BillingActionRate")
  );
}

function buildFallbackGlobalRate(actionType: BillingActionType): BillingActionRate {
  const defaults = DEFAULT_BILLING_ACTION_RULES[actionType];
  const now = new Date();

  return {
    id: `fallback-${actionType.toLowerCase()}`,
    actionType,
    scopeType: "GLOBAL",
    scopeId: null,
    pricingType: defaults.pricingType,
    fixedAmount:
      defaults.fixedAmount != null ? new Prisma.Decimal(defaults.fixedAmount) : null,
    percentRate:
      defaults.percentRate != null ? new Prisma.Decimal(defaults.percentRate) : null,
    minimumAmount:
      defaults.minimumAmount != null ? new Prisma.Decimal(defaults.minimumAmount) : null,
    maximumAmount:
      defaults.maximumAmount != null ? new Prisma.Decimal(defaults.maximumAmount) : null,
    currency: "BYN",
    isActive: defaults.isActive,
    startsAt: null,
    endsAt: null,
    reason: defaults.reason,
    createdById: null,
    createdAt: now,
    updatedAt: now,
  };
}

function isRuleActiveAt(rule: BillingActionRate, occurredAt: Date) {
  if (!rule.isActive) return false;
  if (rule.startsAt && rule.startsAt > occurredAt) return false;
  if (rule.endsAt && rule.endsAt < occurredAt) return false;
  return true;
}

function ruleSort(a: BillingActionRate, b: BillingActionRate) {
  const aStart = a.startsAt?.getTime() ?? 0;
  const bStart = b.startsAt?.getTime() ?? 0;
  if (aStart !== bStart) return bStart - aStart;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

export async function ensureDefaultBillingActionRates(createdById?: string | null) {
  const delegate = getBillingActionRateDelegate();
  if (!delegate) {
    return BILLING_ACTION_TYPES.map((actionType) => buildFallbackGlobalRate(actionType));
  }

  try {
    await Promise.all(
      (Object.keys(DEFAULT_BILLING_ACTION_RULES) as BillingActionType[]).map(async (actionType) => {
        const existing = await delegate.findFirst({
          where: {
            actionType,
            scopeType: "GLOBAL",
            scopeId: null,
          },
        });

        if (existing) {
          return existing;
        }

        const defaults = DEFAULT_BILLING_ACTION_RULES[actionType];
        return delegate.create({
          data: {
            actionType,
            scopeType: "GLOBAL",
            scopeId: null,
            pricingType: defaults.pricingType,
            fixedAmount: defaults.fixedAmount,
            percentRate: defaults.percentRate,
            minimumAmount: defaults.minimumAmount,
            maximumAmount: defaults.maximumAmount,
            currency: "BYN",
            isActive: defaults.isActive,
            reason: defaults.reason,
            createdById: createdById ?? null,
          },
        });
      }),
    );
  } catch (error) {
    if (isMissingBillingActionRateTableError(error)) {
      return BILLING_ACTION_TYPES.map((actionType) => buildFallbackGlobalRate(actionType));
    }

    throw error;
  }
}

export async function listBillingActionRates(params?: {
  scopeType?: BillingRateScopeType;
  scopeId?: string | null;
  actionType?: BillingActionType;
  includeInactive?: boolean;
}) {
  const delegate = getBillingActionRateDelegate();
  if (!delegate) {
    const fallbackRates =
      params?.scopeType === "BUSINESS"
        ? []
        : BILLING_ACTION_TYPES.map((actionType) => buildFallbackGlobalRate(actionType));
    return params?.includeInactive ? fallbackRates : fallbackRates.filter((rate) => rate.isActive);
  }

  const where: Prisma.BillingActionRateWhereInput = {};

  if (params?.scopeType) where.scopeType = params.scopeType;
  if (params?.scopeId !== undefined) where.scopeId = params.scopeId;
  if (params?.actionType) where.actionType = params.actionType;
  if (!params?.includeInactive) where.isActive = true;

  try {
    return await delegate.findMany({
      where,
      orderBy: [{ actionType: "asc" }, { startsAt: "desc" }, { updatedAt: "desc" }],
    });
  } catch (error) {
    if (isMissingBillingActionRateTableError(error)) {
      const fallbackRates =
        params?.scopeType === "BUSINESS"
          ? []
          : BILLING_ACTION_TYPES.map((actionType) => buildFallbackGlobalRate(actionType));
      return params?.includeInactive ? fallbackRates : fallbackRates.filter((rate) => rate.isActive);
    }

    throw error;
  }
}

export async function upsertGlobalBillingActionRate(params: {
  actionType: BillingActionType;
  pricingType: BillingActionPricingType;
  fixedAmount?: number | null;
  percentRate?: number | null;
  minimumAmount?: number | null;
  maximumAmount?: number | null;
  currency?: string;
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  reason?: string | null;
  createdById?: string | null;
}) {
  const delegate = getBillingActionRateDelegate();
  if (!delegate) {
    throw new Error("BillingActionRate model is unavailable in the current Prisma Client. Restart the server after prisma generate.");
  }

  const existing = await delegate.findFirst({
    where: {
      actionType: params.actionType,
      scopeType: "GLOBAL",
      scopeId: null,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const data = {
    actionType: params.actionType,
    scopeType: "GLOBAL" as BillingRateScopeType,
    scopeId: null,
    pricingType: params.pricingType,
    fixedAmount: params.fixedAmount ?? null,
    percentRate: params.percentRate ?? null,
    minimumAmount: params.minimumAmount ?? null,
    maximumAmount: params.maximumAmount ?? null,
    currency: params.currency ?? "BYN",
    isActive: params.isActive,
    startsAt: params.startsAt ?? null,
    endsAt: params.endsAt ?? null,
    reason: params.reason ?? null,
    createdById: params.createdById ?? null,
  };

  if (existing) {
    return delegate.update({
      where: { id: existing.id },
      data,
    });
  }

  return delegate.create({ data });
}

export async function createBusinessBillingActionRate(params: {
  businessId: string;
  actionType: BillingActionType;
  pricingType: BillingActionPricingType;
  fixedAmount?: number | null;
  percentRate?: number | null;
  minimumAmount?: number | null;
  maximumAmount?: number | null;
  currency?: string;
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  reason?: string | null;
  createdById?: string | null;
}) {
  const delegate = getBillingActionRateDelegate();
  if (!delegate) {
    throw new Error("BillingActionRate model is unavailable in the current Prisma Client. Restart the server after prisma generate.");
  }

  return delegate.create({
    data: {
      actionType: params.actionType,
      scopeType: "BUSINESS",
      scopeId: params.businessId,
      pricingType: params.pricingType,
      fixedAmount: params.fixedAmount ?? null,
      percentRate: params.percentRate ?? null,
      minimumAmount: params.minimumAmount ?? null,
      maximumAmount: params.maximumAmount ?? null,
      currency: params.currency ?? "BYN",
      isActive: params.isActive ?? true,
      startsAt: params.startsAt ?? null,
      endsAt: params.endsAt ?? null,
      reason: params.reason ?? null,
      createdById: params.createdById ?? null,
    },
  });
}

export async function resolveBillingActionRate(params: {
  businessId: string;
  actionType: BillingActionType;
  occurredAt?: Date;
}) {
  const occurredAt = params.occurredAt ?? new Date();
  const delegate = getBillingActionRateDelegate();
  if (!delegate) {
    const fallbackRule = buildFallbackGlobalRate(params.actionType);
    return fallbackRule.isActive
      ? ({ rule: fallbackRule, source: "GLOBAL" } as const)
      : ({ rule: null, source: null } as const);
  }

  let businessRules: BillingActionRate[];
  let globalRules: BillingActionRate[];

  try {
    [businessRules, globalRules] = await Promise.all([
      delegate.findMany({
        where: {
          actionType: params.actionType,
          scopeType: "BUSINESS",
          scopeId: params.businessId,
        },
        orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
      }),
      delegate.findMany({
        where: {
          actionType: params.actionType,
          scopeType: "GLOBAL",
          scopeId: null,
        },
        orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
      }),
    ]);
  } catch (error) {
    if (isMissingBillingActionRateTableError(error)) {
      const fallbackRule = buildFallbackGlobalRate(params.actionType);
      return fallbackRule.isActive
        ? ({ rule: fallbackRule, source: "GLOBAL" } as const)
        : ({ rule: null, source: null } as const);
    }

    throw error;
  }

  const businessRule = businessRules.filter((rule) => isRuleActiveAt(rule, occurredAt)).sort(ruleSort)[0] ?? null;
  if (businessRule) {
    return {
      rule: businessRule,
      source: "BUSINESS",
    } as const;
  }

  const globalRule = globalRules.filter((rule) => isRuleActiveAt(rule, occurredAt)).sort(ruleSort)[0] ?? null;
  if (globalRule) {
    return {
      rule: globalRule,
      source: "GLOBAL",
    } as const;
  }

  return {
    rule: null,
    source: null,
  } as const;
}

export function calculateBillingActionAmount(params: {
  rate: Pick<
    BillingActionRate,
    "pricingType" | "fixedAmount" | "percentRate" | "minimumAmount" | "maximumAmount"
  >;
  baseAmount?: number | null;
}) {
  const fixedAmount = toNumber(params.rate.fixedAmount);
  const percentRate = toNumber(params.rate.percentRate);
  const minimumAmount = toNumber(params.rate.minimumAmount);
  const maximumAmount = toNumber(params.rate.maximumAmount);

  let percentAmount: number | null = null;
  let amount = 0;

  switch (params.rate.pricingType) {
    case "FREE":
      amount = 0;
      break;
    case "FIXED":
      amount = fixedAmount ?? 0;
      break;
    case "PERCENT":
      if (params.baseAmount == null) {
        throw new MissingBaseAmountForPercentRateError();
      }
      amount = (params.baseAmount * (percentRate ?? 0)) / 100;
      percentAmount = amount;
      break;
    case "PERCENT_WITH_MINIMUM":
      if (params.baseAmount == null) {
        amount = minimumAmount ?? 0;
        percentAmount = 0;
      } else {
        percentAmount = (params.baseAmount * (percentRate ?? 0)) / 100;
        amount = Math.max(percentAmount, minimumAmount ?? 0);
      }
      break;
  }

  if (maximumAmount != null) {
    amount = Math.min(amount, maximumAmount);
  }

  return {
    amount: normalizeAmount(amount),
    percentAmount: percentAmount == null ? null : normalizeAmount(percentAmount),
  };
}

export async function getBusinessResolvedBillingActionPrices(params: {
  businessId: string;
  occurredAt?: Date;
}) {
  const occurredAt = params.occurredAt ?? new Date();
  const resolved = await Promise.all(
    BILLING_ACTION_TYPES.map(async (actionType) => {
      const result = await resolveBillingActionRate({
        businessId: params.businessId,
        actionType,
        occurredAt,
      });

      return {
        actionType,
        source: result.source,
        rule: result.rule,
      };
    }),
  );

  return resolved.filter((row) => row.rule);
}
