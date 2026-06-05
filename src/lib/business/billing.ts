import { formatPrice } from "@/lib/formatters/format-price";

export type PlanStatus = "active" | "expiring" | "inactive";
export type TransactionType =
  | "plan_renewal"
  | "deposit_topup"
  | "lead_charge"
  | "promotion_charge"
  | "refund"
  | "adjustment";
export type TransactionStatus = "completed" | "pending" | "failed" | "refunded";

export interface BillingPlan {
  id: string;
  name: string;
  status: PlanStatus;
  price: number;
  currency: string;
  period: "month" | "year";
  nextBillingDate: string | null;
  autoRenewal: boolean;
  features: string[];
}

export interface PaymentMethod {
  type: "card";
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface Deposit {
  balance: number;
  currency: string;
  monthSpent: number;
  lowBalanceThreshold: number;
  recommendedTopup: number;
  lastChargeDate: string | null;
  lastChargeAmount: number | null;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  description: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  relatedEntity?: {
    type: string;
    id: string;
    name: string;
  };
  paymentMethod?: string;
}

export interface PlanHistory {
  id: string;
  date: string;
  operation: string;
  amount: number;
  status: TransactionStatus;
}

export interface UsageStats {
  monthSpent: number;
  chargesCount: number;
  averageCharge: number;
  lastCharge: {
    date: string | null;
    amount: number | null;
  };
}

export const EMPTY_BILLING_STATE = {
  plan: null as BillingPlan | null,
  paymentMethod: null as PaymentMethod | null,
  deposit: {
    balance: 0,
    currency: "BYN",
    monthSpent: 0,
    lowBalanceThreshold: 0,
    recommendedTopup: 0,
    lastChargeDate: null,
    lastChargeAmount: null,
  } satisfies Deposit,
  usageStats: {
    monthSpent: 0,
    chargesCount: 0,
    averageCharge: 0,
    lastCharge: { date: null, amount: null },
  } satisfies UsageStats,
  planHistory: [] as PlanHistory[],
  transactions: [] as Transaction[],
};

export function getTransactionTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    plan_renewal: "Продление тарифа",
    deposit_topup: "Пополнение депозита",
    lead_charge: "Списание за лид",
    promotion_charge: "Списание за продвижение",
    refund: "Возврат",
    adjustment: "Корректировка",
  };
  return labels[type];
}

export function getTransactionStatusLabel(status: TransactionStatus): string {
  const labels: Record<TransactionStatus, string> = {
    completed: "Выполнено",
    pending: "В обработке",
    failed: "Ошибка",
    refunded: "Возвращено",
  };
  return labels[status];
}

export function formatCurrency(amount: number, currency: string = "BYN"): string {
  void currency;
  return formatPrice(amount, { hideZero: true });
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
