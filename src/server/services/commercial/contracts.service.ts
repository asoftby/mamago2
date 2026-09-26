/**
 * Business Contracts Service
 * 
 * Manages commercial contracts between businesses and platform.
 * Contracts represent legal agreements and define commercial relationship terms.
 */

import { prisma } from "@/lib/prisma";
import type { ContractStatus, ContractTemplateSource, ContractType, Prisma } from "@prisma/client";

export interface ContractFilters {
  businessId?: string;
  status?: ContractStatus;
  type?: ContractType;
  expiringInDays?: number;
}

export interface CreateContractInput {
  businessId?: string;
  counterpartyId?: string;
  contractNumber: string;
  type: ContractType;
  templateSource?: ContractTemplateSource;
  signedAt?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  autoRenew?: boolean;
  renewalTerms?: string;
  renewalPeriod?: number;
  documentUrl?: string;
  notes?: string;
  totalAmount?: number;
  currency?: string;
  prepaymentPercent?: number;
  prepaymentDueAt?: Date | null;
  postpaymentDueAt?: Date | null;
  paymentComment?: string;
  platform?: string;
  items?: Array<{
    name: string;
    amount: number;
    sortOrder?: number;
  }>;
}

export interface UpdateContractInput {
  contractNumber?: string;
  type?: ContractType;
  status?: ContractStatus;
  signedAt?: Date;
  startsAt?: Date;
  endsAt?: Date;
  autoRenew?: boolean;
  renewalTerms?: string;
  renewalPeriod?: number;
  documentUrl?: string;
  notes?: string;
}

/**
 * Get contracts with filters
 */
export async function getContracts(filters: ContractFilters = {}) {
  const where: Prisma.BusinessContractWhereInput = {};

  if (filters.businessId) {
    where.businessId = filters.businessId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.expiringInDays) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + filters.expiringInDays * 24 * 60 * 60 * 1000);
    where.endsAt = {
      gte: now,
      lte: futureDate,
    };
    where.status = "ACTIVE";
  }

  return prisma.businessContract.findMany({
    where,
    include: {
      business: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      counterparty: {
        select: {
          id: true,
          name: true,
          unp: true,
          contactName: true,
          phoneE164: true,
          businessId: true,
        },
      },
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: {
      endsAt: "asc",
    },
  });
}

/**
 * Get contract by ID
 */
export async function getContractById(id: string) {
  return prisma.businessContract.findUnique({
    where: { id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          status: true,
          phone: true,
        },
      },
      counterparty: true,
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/**
 * Get contracts for a business
 */
export async function getBusinessContracts(businessId: string) {
  return prisma.businessContract.findMany({
    where: { businessId },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Create new contract
 */
export async function createContract(input: CreateContractInput) {
  if (!input.businessId && !input.counterpartyId) {
    throw new Error("Contract requires a business or commercial counterparty");
  }

  return prisma.businessContract.create({
    data: {
      businessId: input.businessId,
      counterpartyId: input.counterpartyId,
      contractNumber: input.contractNumber,
      type: input.type,
      templateSource: input.templateSource ?? "MAMAGO",
      status: input.signedAt ? "ACTIVE" : "DRAFT",
      signedAt: input.signedAt ?? null,
      startsAt: input.startsAt ?? input.signedAt ?? null,
      endsAt: input.endsAt ?? null,
      autoRenew: input.autoRenew ?? false,
      renewalTerms: input.renewalTerms,
      renewalPeriod: input.renewalPeriod,
      documentUrl: input.documentUrl,
      notes: input.notes,
      totalAmount: input.totalAmount ?? 0,
      currency: input.currency ?? "BYN",
      prepaymentPercent: input.prepaymentPercent ?? 0,
      prepaymentDueAt: input.prepaymentDueAt ?? null,
      postpaymentDueAt: input.postpaymentDueAt ?? null,
      paymentComment: input.paymentComment,
      platform: input.platform ?? "MAMAGO_BY",
      items: input.items?.length
        ? {
            create: input.items.map((item, index) => ({
              name: item.name,
              amount: item.amount,
              sortOrder: item.sortOrder ?? index,
            })),
          }
        : undefined,
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
      counterparty: true,
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

/**
 * Update contract
 */
export async function updateContract(id: string, input: UpdateContractInput) {
  return prisma.businessContract.update({
    where: { id },
    data: input,
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Mark contract as signed
 */
export async function markContractSigned(id: string, signedAt: Date) {
  return prisma.businessContract.update({
    where: { id },
    data: {
      status: "ACTIVE",
      signedAt,
    },
  });
}

/**
 * Extend contract
 */
export async function extendContract(id: string, newEndsAt: Date) {
  return prisma.businessContract.update({
    where: { id },
    data: {
      endsAt: newEndsAt,
      status: "ACTIVE",
    },
  });
}

/**
 * Terminate contract
 */
export async function terminateContract(id: string, reason?: string) {
  return prisma.businessContract.update({
    where: { id },
    data: {
      status: "TERMINATED",
      notes: reason ? `Terminated: ${reason}` : undefined,
    },
  });
}

/**
 * Get expiring contracts (for notifications)
 */
export async function getExpiringContracts(daysAhead: number) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return prisma.businessContract.findMany({
    where: {
      status: "ACTIVE",
      endsAt: {
        gte: now,
        lte: futureDate,
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
        },
      },
    },
    orderBy: {
      endsAt: "asc",
    },
  });
}

/**
 * Get expired contracts
 */
export async function getExpiredContracts() {
  const now = new Date();

  return prisma.businessContract.findMany({
    where: {
      status: {
        in: ["ACTIVE", "EXPIRING"],
      },
      endsAt: {
        lt: now,
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Update contract statuses (cron job)
 */
export async function updateContractStatuses() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Mark contracts as EXPIRING (30 days before end)
  await prisma.businessContract.updateMany({
    where: {
      status: "ACTIVE",
      endsAt: {
        gte: now,
        lte: in30Days,
      },
    },
    data: {
      status: "EXPIRING",
    },
  });

  // Mark contracts as EXPIRED
  await prisma.businessContract.updateMany({
    where: {
      status: {
        in: ["ACTIVE", "EXPIRING"],
      },
      endsAt: {
        lt: now,
      },
    },
    data: {
      status: "EXPIRED",
    },
  });
}
