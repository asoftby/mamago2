import type {
  BillingActionPricingType,
  BillingActionType,
  BillingRateScopeType,
} from "@prisma/client";
import { formatPrice } from "@/lib/formatters/format-price";

export const BILLING_ACTION_TITLES: Record<BillingActionType, string> = {
  LEAD_CREATED: "Заявка создана",
  BOOKING_CONFIRMED: "Подтверждённый заказ",
  CONTACT_OPENED: "Открытие контакта",
  VISIT_CONFIRMED: "Подтверждённый визит",
};

export const BILLING_ACTION_SHORT_TITLES: Record<BillingActionType, string> = {
  LEAD_CREATED: "Заявка",
  BOOKING_CONFIRMED: "Подтверждённый заказ",
  CONTACT_OPENED: "Открытие контакта",
  VISIT_CONFIRMED: "Подтверждённый визит",
};

export const BILLING_PRICING_TYPE_LABELS: Record<BillingActionPricingType, string> = {
  FREE: "Бесплатно",
  FIXED: "Фиксированная",
  PERCENT: "Процент",
  PERCENT_WITH_MINIMUM: "Процент с минимумом",
};

export const BILLING_SCOPE_LABELS: Record<BillingRateScopeType, string> = {
  GLOBAL: "Глобальное правило",
  BUSINESS: "Индивидуальные условия",
};

type DecimalLike = { toNumber(): number };

type RateLike = {
  pricingType: BillingActionPricingType;
  fixedAmount: DecimalLike | number | null;
  percentRate: DecimalLike | number | null;
  minimumAmount: DecimalLike | number | null;
  maximumAmount: DecimalLike | number | null;
  currency: string;
};

function decimalToNumber(value: DecimalLike | number | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

export function formatBillingActionPrice(rate: RateLike): string {
  const fixedAmount = decimalToNumber(rate.fixedAmount);
  const percentRate = decimalToNumber(rate.percentRate);
  const minimumAmount = decimalToNumber(rate.minimumAmount);
  const maximumAmount = decimalToNumber(rate.maximumAmount);

  switch (rate.pricingType) {
    case "FREE":
      return "Бесплатно";
    case "FIXED":
      return formatPrice(fixedAmount ?? 0);
    case "PERCENT":
      return `${percentRate ?? 0}% от суммы заказа`;
    case "PERCENT_WITH_MINIMUM": {
      const percentPart = `${percentRate ?? 0}% от суммы заказа`;
      if (minimumAmount != null && maximumAmount != null) {
        return `${percentPart}, от ${formatPrice(minimumAmount)} до ${formatPrice(maximumAmount)}`;
      }
      if (minimumAmount != null) {
        return `${percentPart}, но не менее ${formatPrice(minimumAmount)}`;
      }
      return percentPart;
    }
    default:
      return "—";
  }
}

export function formatBillingActionPeriod(params: {
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const { startsAt, endsAt } = params;

  if (!startsAt && !endsAt) {
    return "Без ограничения";
  }

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (startsAt && endsAt) {
    return `${formatter.format(startsAt)} - ${formatter.format(endsAt)}`;
  }

  if (startsAt) {
    return `c ${formatter.format(startsAt)}`;
  }

  return `до ${formatter.format(endsAt as Date)}`;
}
