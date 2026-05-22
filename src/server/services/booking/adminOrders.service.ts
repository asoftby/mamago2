import prisma from "@/lib/prisma";
import { resolveBookingSourceType, type BookingSourceType } from "./booking.types";
import type { Prisma, BookingStatus, PublicationType, BillingTransactionStatus, BillingTransactionType } from "@prisma/client";

export interface AdminOrdersFilters {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  businessId?: string;
  cityId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  publicationType?: PublicationType;
  entityType?: BookingSourceType;
}

export interface AdminOrderActivitySummary {
  id: string;
  type: string;
  actorType: string;
  actorId: string | null;
  payload: Prisma.JsonValue | null;
  createdAt: string;
}

export interface AdminOrderItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BookingStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  business: {
    id: string;
    name: string;
  };
  publicationType: PublicationType;
  entityType: BookingSourceType;
  entityId: string | null;
  entityTitle: string | null;
  cityId: string | null;
  sourceChannel: string | null;
  campShiftSnapshot: {
    id: string;
    title: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  } | null;
  latestActivity: AdminOrderActivitySummary | null;
}

export interface AdminOrdersResult {
  orders: AdminOrderItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: Record<BookingStatus, number>;
}

// ─── Financial data ───────────────────────────────────────────────────────────

export interface OrderFinancialTransaction {
  id: string;
  type: BillingTransactionType;
  status: BillingTransactionStatus;
  amount: string;
  currency: string;
  description: string;
  occurredAt: string;
  businessId: string;
}

export interface OrderFinancials {
  debit: OrderFinancialTransaction | null;
  refunds: OrderFinancialTransaction[];
}

async function getOrderFinancials(bookingRequestId: string): Promise<OrderFinancials> {
  const tx = await prisma.billingTransaction.findFirst({
    where: {
      referenceId: bookingRequestId,
      referenceType: "REQUEST",
    },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      currency: true,
      description: true,
      occurredAt: true,
      billingAccount: { select: { businessId: true } },
      childTransactions: {
        where: { type: "REFUND" },
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          currency: true,
          description: true,
          occurredAt: true,
          billingAccount: { select: { businessId: true } },
        },
      },
    },
  });

  if (!tx) return { debit: null, refunds: [] };

  const toRow = (
    row: typeof tx | typeof tx.childTransactions[number],
  ): OrderFinancialTransaction => ({
    id: row.id,
    type: row.type,
    status: row.status,
    amount: row.amount.toString(),
    currency: row.currency,
    description: row.description,
    occurredAt: row.occurredAt.toISOString(),
    businessId: row.billingAccount.businessId,
  });

  return {
    debit: toRow(tx),
    refunds: tx.childTransactions.map(toRow),
  };
}

function normalizeDateStart(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function normalizeDateEnd(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

function buildOrdersWhere(filters: Omit<AdminOrdersFilters, "page" | "limit" | "status"> & {
  status?: BookingStatus;
}): Prisma.BookingRequestWhereInput {
  const and: Prisma.BookingRequestWhereInput[] = [];

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.businessId) {
    and.push({ businessId: filters.businessId });
  }

  if (filters.publicationType) {
    and.push({ publicationType: filters.publicationType });
  }

  if (filters.entityType === "CAMP_SHIFT") {
    and.push({
      campShiftId: { not: null },
      offerId: { not: null },
    });
  } else if (
    filters.entityType &&
    filters.entityType !== "UNKNOWN" &&
    !filters.publicationType
  ) {
    const mappedType: PublicationType | null =
      filters.entityType === "EVENT"
        ? "EVENT"
        : filters.entityType === "OFFER"
          ? "OFFER"
          : filters.entityType === "PLACE"
            ? "PLACE"
            : null;

    if (mappedType) {
      and.push({ publicationType: mappedType });
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) {
      createdAt.gte = normalizeDateStart(filters.dateFrom);
    }
    if (filters.dateTo) {
      createdAt.lte = normalizeDateEnd(filters.dateTo);
    }
    and.push({ createdAt });
  }

  if (filters.cityId) {
    and.push({
      OR: [
        { activity: { is: { cityId: filters.cityId } } },
        { activity: { is: { place: { is: { cityId: filters.cityId } } } } },
        { offer: { is: { place: { is: { cityId: filters.cityId } } } } },
        { place: { is: { cityId: filters.cityId } } },
      ],
    });
  }

  const trimmedSearch = filters.search?.trim();
  if (trimmedSearch) {
    and.push({
      OR: [
        { customerName: { contains: trimmedSearch, mode: "insensitive" } },
        { customerPhone: { contains: trimmedSearch, mode: "insensitive" } },
        { customerEmail: { contains: trimmedSearch, mode: "insensitive" } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

function mapAdminOrder(
  booking: Awaited<ReturnType<typeof fetchAdminOrdersRows>>[number],
): AdminOrderItem {
  const entityType = resolveBookingSourceType(booking);
  const latestActivity = booking.activities[0] ?? null;
  const entityId = booking.activityId ?? booking.offerId ?? booking.placeId ?? null;
  const entityTitle =
    booking.activity?.title ??
    booking.offer?.title ??
    booking.place?.title ??
    booking.campShiftTitle ??
    null;
  const cityId =
    booking.activity?.cityId ??
    booking.activity?.place?.cityId ??
    booking.offer?.place?.cityId ??
    booking.place?.cityId ??
    null;

  return {
    id: booking.id,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    status: booking.status,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail,
    business: {
      id: booking.business.id,
      name: booking.business.name,
    },
    publicationType: booking.publicationType,
    entityType,
    entityId,
    entityTitle,
    cityId,
    sourceChannel: null,
    campShiftSnapshot: booking.campShiftId
      ? {
          id: booking.campShiftId,
          title: booking.campShiftTitle,
          dateFrom: booking.campShiftDateFrom?.toISOString() ?? null,
          dateTo: booking.campShiftDateTo?.toISOString() ?? null,
        }
      : null,
    latestActivity: latestActivity
      ? {
          id: latestActivity.id,
          type: latestActivity.type,
          actorType: latestActivity.actorType,
          actorId: latestActivity.actorId,
          payload: latestActivity.payload as Prisma.JsonValue | null,
          createdAt: latestActivity.createdAt.toISOString(),
        }
      : null,
  };
}

function fetchAdminOrdersRows(args: {
  where: Prisma.BookingRequestWhereInput;
  skip?: number;
  take?: number;
}) {
  return prisma.bookingRequest.findMany({
    where: args.where,
    orderBy: { createdAt: "desc" },
    skip: args.skip,
    take: args.take,
    select: {
      id: true,
      activityId: true,
      offerId: true,
      placeId: true,
      publicationType: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      campShiftId: true,
      campShiftTitle: true,
      campShiftDateFrom: true,
      campShiftDateTo: true,
      business: {
        select: {
          id: true,
          name: true,
        },
      },
      activity: {
        select: {
          id: true,
          title: true,
          cityId: true,
          place: {
            select: {
              cityId: true,
            },
          },
        },
      },
      offer: {
        select: {
          id: true,
          title: true,
          place: {
            select: {
              cityId: true,
              title: true,
            },
          },
        },
      },
      place: {
        select: {
          id: true,
          title: true,
          cityId: true,
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          type: true,
          actorType: true,
          actorId: true,
          payload: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function getAdminOrders(
  filters: AdminOrdersFilters,
): Promise<AdminOrdersResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.max(1, filters.limit ?? 20);
  const skip = (page - 1) * limit;

  const baseFilters = {
    businessId: filters.businessId,
    cityId: filters.cityId,
    search: filters.search,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    publicationType: filters.publicationType,
    entityType: filters.entityType,
  };

  const where = buildOrdersWhere({
    ...baseFilters,
    status: filters.status,
  });
  const countsWhere = buildOrdersWhere(baseFilters);

  const [rows, total, newCount, confirmedCount, rejectedCount, cancelledCount, completedCount] =
    await prisma.$transaction([
    fetchAdminOrdersRows({ where, skip, take: limit }),
    prisma.bookingRequest.count({ where }),
    prisma.bookingRequest.count({ where: { ...countsWhere, status: "NEW" } }),
    prisma.bookingRequest.count({ where: { ...countsWhere, status: "CONFIRMED" } }),
    prisma.bookingRequest.count({ where: { ...countsWhere, status: "REJECTED" } }),
    prisma.bookingRequest.count({ where: { ...countsWhere, status: "CANCELLED" } }),
    prisma.bookingRequest.count({ where: { ...countsWhere, status: "COMPLETED" } }),
  ]);

  return {
    orders: rows.map(mapAdminOrder),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    statusCounts: {
      NEW: newCount,
      CONFIRMED: confirmedCount,
      REJECTED: rejectedCount,
      CANCELLED: cancelledCount,
      COMPLETED: completedCount,
    },
  };
}

export async function getAdminOrderById(id: string) {
  const [rows, financials] = await Promise.all([
    fetchAdminOrdersRows({ where: { id }, take: 1 }),
    getOrderFinancials(id),
  ]);

  const booking = rows[0];
  if (!booking) return null;

  return { ...mapAdminOrder(booking), financials };
}
