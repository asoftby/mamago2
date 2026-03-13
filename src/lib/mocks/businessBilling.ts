// Mock data for business billing UI/UX prototype
// This is NOT connected to real payment systems

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
  nextBillingDate: string;
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
  lastChargeDate: string;
  lastChargeAmount: number;
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
    date: string;
    amount: number;
  };
}

// Mock current plan
export const mockCurrentPlan: BillingPlan = {
  id: "plan_001",
  name: "Business Pro",
  status: "active",
  price: 59,
  currency: "BYN",
  period: "month",
  nextBillingDate: "2026-04-15",
  autoRenewal: true,
  features: [
    "Неограниченное количество мест",
    "Неограниченное количество событий",
    "Неограниченное количество предложений",
    "Stories и промо-материалы",
    "Приоритет в поисковой выдаче",
    "Доступ к лидам и заявкам",
    "Аналитика и статистика",
    "Приоритетная поддержка",
  ],
};

// Mock payment method
export const mockPaymentMethod: PaymentMethod = {
  type: "card",
  brand: "Visa",
  last4: "4242",
  expiryMonth: 12,
  expiryYear: 2027,
};

// Mock deposit
export const mockDeposit: Deposit = {
  balance: 84.50,
  currency: "BYN",
  monthSpent: 36.20,
  lowBalanceThreshold: 20,
  recommendedTopup: 100,
  lastChargeDate: "2026-03-12",
  lastChargeAmount: 4.50,
};

// Mock usage stats
export const mockUsageStats: UsageStats = {
  monthSpent: 36.20,
  chargesCount: 12,
  averageCharge: 3.02,
  lastCharge: {
    date: "2026-03-12",
    amount: 4.50,
  },
};

// Mock plan history
export const mockPlanHistory: PlanHistory[] = [
  {
    id: "ph_001",
    date: "2026-03-15",
    operation: "Продление тарифа Business Pro",
    amount: 59,
    status: "completed",
  },
  {
    id: "ph_002",
    date: "2026-02-15",
    operation: "Продление тарифа Business Pro",
    amount: 59,
    status: "completed",
  },
  {
    id: "ph_003",
    date: "2026-01-15",
    operation: "Продление тарифа Business Pro",
    amount: 59,
    status: "completed",
  },
  {
    id: "ph_004",
    date: "2025-12-15",
    operation: "Активация тарифа Business Pro",
    amount: 59,
    status: "completed",
  },
];

// Mock transactions
export const mockTransactions: Transaction[] = [
  {
    id: "tx_001",
    date: "2026-03-15T10:30:00Z",
    type: "plan_renewal",
    description: "Продление тарифа Business Pro",
    amount: -59,
    currency: "BYN",
    status: "completed",
    paymentMethod: "Visa **** 4242",
  },
  {
    id: "tx_002",
    date: "2026-03-12T14:22:00Z",
    type: "lead_charge",
    description: "Списание за лид: Детский центр Солнышко",
    amount: -4.50,
    currency: "BYN",
    status: "completed",
    relatedEntity: {
      type: "place",
      id: "place_123",
      name: "Детский центр Солнышко",
    },
  },
  {
    id: "tx_003",
    date: "2026-03-10T09:15:00Z",
    type: "promotion_charge",
    description: "Продвижение предложения: Скидка 20% на абонемент",
    amount: -12,
    currency: "BYN",
    status: "completed",
    relatedEntity: {
      type: "offer",
      id: "offer_456",
      name: "Скидка 20% на абонемент",
    },
  },
  {
    id: "tx_004",
    date: "2026-03-08T16:45:00Z",
    type: "deposit_topup",
    description: "Пополнение депозита",
    amount: 100,
    currency: "BYN",
    status: "completed",
    paymentMethod: "Visa **** 4242",
  },
  {
    id: "tx_005",
    date: "2026-03-05T11:20:00Z",
    type: "lead_charge",
    description: "Списание за лид: Спортивная секция Чемпион",
    amount: -3.80,
    currency: "BYN",
    status: "completed",
    relatedEntity: {
      type: "place",
      id: "place_789",
      name: "Спортивная секция Чемпион",
    },
  },
  {
    id: "tx_006",
    date: "2026-03-03T13:10:00Z",
    type: "promotion_charge",
    description: "Продвижение события: День открытых дверей",
    amount: -8,
    currency: "BYN",
    status: "completed",
    relatedEntity: {
      type: "event",
      id: "event_321",
      name: "День открытых дверей",
    },
  },
  {
    id: "tx_007",
    date: "2026-02-28T10:05:00Z",
    type: "lead_charge",
    description: "Списание за лид: Творческая студия Радуга",
    amount: -4.20,
    currency: "BYN",
    status: "completed",
    relatedEntity: {
      type: "place",
      id: "place_654",
      name: "Творческая студия Радуга",
    },
  },
  {
    id: "tx_008",
    date: "2026-02-25T15:30:00Z",
    type: "refund",
    description: "Возврат за отмененное продвижение",
    amount: 5,
    currency: "BYN",
    status: "completed",
  },
  {
    id: "tx_009",
    date: "2026-02-20T09:45:00Z",
    type: "lead_charge",
    description: "Списание за лид: Языковая школа Полиглот",
    amount: -3.50,
    currency: "BYN",
    status: "completed",
    relatedEntity: {
      type: "place",
      id: "place_987",
      name: "Языковая школа Полиглот",
    },
  },
  {
    id: "tx_010",
    date: "2026-02-15T10:30:00Z",
    type: "plan_renewal",
    description: "Продление тарифа Business Pro",
    amount: -59,
    currency: "BYN",
    status: "completed",
    paymentMethod: "Visa **** 4242",
  },
  {
    id: "tx_011",
    date: "2026-02-12T14:15:00Z",
    type: "deposit_topup",
    description: "Пополнение депозита",
    amount: 50,
    currency: "BYN",
    status: "completed",
    paymentMethod: "Visa **** 4242",
  },
  {
    id: "tx_012",
    date: "2026-02-10T11:20:00Z",
    type: "promotion_charge",
    description: "Продвижение предложения: Бесплатное пробное занятие",
    amount: -6,
    currency: "BYN",
    status: "completed",
    relatedEntity: {
      type: "offer",
      id: "offer_111",
      name: "Бесплатное пробное занятие",
    },
  },
  {
    id: "tx_013",
    date: "2026-02-05T16:40:00Z",
    type: "lead_charge",
    description: "Списание за лид: Музыкальная школа Гармония",
    amount: -4,
    currency: "BYN",
    status: "completed",
    relatedEntity: {
      type: "place",
      id: "place_222",
      name: "Музыкальная школа Гармония",
    },
  },
  {
    id: "tx_014",
    date: "2026-01-28T12:30:00Z",
    type: "adjustment",
    description: "Корректировка баланса",
    amount: 10,
    currency: "BYN",
    status: "completed",
  },
  {
    id: "tx_015",
    date: "2026-01-15T10:30:00Z",
    type: "plan_renewal",
    description: "Продление тарифа Business Pro",
    amount: -59,
    currency: "BYN",
    status: "completed",
    paymentMethod: "Visa **** 4242",
  },
];

// Helper to get transaction type label
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

// Helper to get transaction status label
export function getTransactionStatusLabel(status: TransactionStatus): string {
  const labels: Record<TransactionStatus, string> = {
    completed: "Выполнено",
    pending: "В обработке",
    failed: "Ошибка",
    refunded: "Возвращено",
  };
  return labels[status];
}

// Helper to format currency
export function formatCurrency(amount: number, currency: string = "BYN"): string {
  return `${amount.toFixed(2)} ${currency}`;
}

// Helper to format date
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Helper to format datetime
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
