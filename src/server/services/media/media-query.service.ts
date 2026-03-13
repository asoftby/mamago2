/**
 * Media Query Service
 * 
 * Handles complex queries, filtering, pagination, and search for media assets.
 */

import { prisma } from "@/lib/prisma";
import { MediaAssetKind, MediaAssetStatus, MediaSourceType, Prisma } from "@prisma/client";

export interface MediaListFilters {
  kind?: MediaAssetKind;
  status?: MediaAssetStatus | MediaAssetStatus[] | string[];
  sourceType?: MediaSourceType;
  uploadedById?: string;
  isOrphaned?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MediaListPagination {
  page?: number;
  limit?: number;
}

export interface MediaListSort {
  field?: "createdAt" | "updatedAt" | "filename" | "sizeBytes";
  order?: "asc" | "desc";
}

/**
 * Get paginated media list with filters
 */
export async function getAdminMediaList(
  filters: MediaListFilters = {},
  pagination: MediaListPagination = {},
  sort: MediaListSort = {}
) {
  const page = pagination.page || 1;
  const limit = pagination.limit || 50;
  const skip = (page - 1) * limit;

  const sortField = sort.field || "createdAt";
  const sortOrder = sort.order || "desc";

  // Build where clause
  const where: Prisma.MediaAssetWhereInput = {};

  if (filters.kind) {
    where.kind = filters.kind;
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      where.status = { in: filters.status as MediaAssetStatus[] };
    } else {
      where.status = filters.status as MediaAssetStatus;
    }
  }

  if (filters.sourceType) {
    where.sourceType = filters.sourceType;
  }

  if (filters.uploadedById) {
    where.uploadedById = filters.uploadedById;
  }

  if (filters.isOrphaned !== undefined) {
    where.status = filters.isOrphaned 
      ? MediaAssetStatus.ORPHANED 
      : { not: MediaAssetStatus.ORPHANED };
  }

  if (filters.search) {
    where.OR = [
      { filename: { contains: filters.search, mode: "insensitive" } },
      { originalName: { contains: filters.search, mode: "insensitive" } },
      { storageKey: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.createdAt.lte = filters.dateTo;
    }
  }

  // Execute query
  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortField]: sortOrder,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            email: true,
          },
        },
        usages: {
          select: {
            id: true,
            entityType: true,
            entityId: true,
            field: true,
          },
        },
      },
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Search media by filename or original name
 */
export async function searchMedia(query: string, limit = 20) {
  return prisma.mediaAsset.findMany({
    where: {
      OR: [
        { filename: { contains: query, mode: "insensitive" } },
        { originalName: { contains: query, mode: "insensitive" } },
        { storageKey: { contains: query, mode: "insensitive" } },
      ],
      status: {
        not: MediaAssetStatus.DELETED,
      },
    },
    take: limit,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      usages: {
        select: {
          id: true,
        },
      },
    },
  });
}

/**
 * Get orphaned media
 */
export async function getOrphanedMedia(limit = 100) {
  return prisma.mediaAsset.findMany({
    where: {
      status: MediaAssetStatus.ORPHANED,
    },
    take: limit,
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Get recently uploaded media
 */
export async function getRecentMedia(limit = 20) {
  return prisma.mediaAsset.findMany({
    where: {
      status: {
        not: MediaAssetStatus.DELETED,
      },
    },
    take: limit,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          email: true,
        },
      },
      usages: {
        select: {
          id: true,
        },
      },
    },
  });
}

/**
 * Get media by checksum (for deduplication)
 */
export async function getMediaByChecksum(checksum: string) {
  return prisma.mediaAsset.findMany({
    where: {
      checksum,
      status: {
        not: MediaAssetStatus.DELETED,
      },
    },
  });
}
