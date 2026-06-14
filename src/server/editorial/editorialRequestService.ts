import type { Prisma } from "@prisma/client";
import { SignalDomain, SignalEntityType, SignalStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  type EditorialRequestInput,
  type EditorialRequestListQuery,
  normalizeEditorialRequestCriteria,
} from "@/lib/editorial/schemas";
import { listDiscoveryClassChips } from "@/server/discovery/classChips";

export type EditorialRequestListItem = {
  id: string;
  title: string;
  status: string;
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
  city: { id: string; name: string; slug: string } | null;
  criteriaSummary: {
    discoverySignalCount: number;
    classChipCount: number;
  };
};

export type EditorialSignalOption = {
  id: string;
  label: string;
  value: string;
};

export type EditorialSignalGroup = {
  id: string;
  slug: string;
  title: string;
  options: EditorialSignalOption[];
};

export type EditorialClassChipOption = {
  slug: string;
  title: string;
};

export type EditorialRequestDetail = {
  id: string;
  title: string;
  description: string | null;
  cityId: string | null;
  status: string;
  deadlineAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  city: { id: string; name: string; slug: string } | null;
  criteria: {
    discoverySignalIds: string[];
    classChipSlugs: string[];
  };
};

function toListItem(row: {
  id: string;
  title: string;
  status: string;
  deadlineAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  city: { id: string; name: string; slug: string } | null;
  criteria: Prisma.JsonValue | null;
}): EditorialRequestListItem {
  const criteria = normalizeEditorialRequestCriteria(row.criteria);

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    deadlineAt: row.deadlineAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    city: row.city,
    criteriaSummary: {
      discoverySignalCount: criteria.discoverySignalIds.length,
      classChipCount: criteria.classChipSlugs.length,
    },
  };
}

function toDetail(row: {
  id: string;
  title: string;
  description: string | null;
  cityId: string | null;
  status: string;
  deadlineAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  city: { id: string; name: string; slug: string } | null;
  criteria: Prisma.JsonValue | null;
}): EditorialRequestDetail {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    cityId: row.cityId,
    status: row.status,
    deadlineAt: row.deadlineAt?.toISOString() ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    city: row.city,
    criteria: normalizeEditorialRequestCriteria(row.criteria),
  };
}

export async function listEditorialRequests(
  query: EditorialRequestListQuery = {},
): Promise<EditorialRequestListItem[]> {
  const rows = await prisma.editorialRequest.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      deadlineAt: true,
      createdAt: true,
      updatedAt: true,
      criteria: true,
      city: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(toListItem);
}

export async function getEditorialRequestById(
  id: string,
): Promise<EditorialRequestDetail | null> {
  const row = await prisma.editorialRequest.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      cityId: true,
      status: true,
      deadlineAt: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      criteria: true,
      city: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return row ? toDetail(row) : null;
}

export async function createEditorialRequest(
  input: EditorialRequestInput,
  userId: string,
): Promise<EditorialRequestDetail> {
  const created = await prisma.editorialRequest.create({
    data: {
      title: input.title,
      description: input.description,
      cityId: input.cityId,
      status: input.status,
      deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
      criteria: input.criteria as Prisma.InputJsonValue,
      createdById: userId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      cityId: true,
      status: true,
      deadlineAt: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      criteria: true,
      city: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return toDetail(created);
}

export async function updateEditorialRequest(
  id: string,
  input: EditorialRequestInput,
): Promise<EditorialRequestDetail | null> {
  const existing = await prisma.editorialRequest.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.editorialRequest.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      cityId: input.cityId,
      status: input.status,
      deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
      criteria: input.criteria as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      title: true,
      description: true,
      cityId: true,
      status: true,
      deadlineAt: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      criteria: true,
      city: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return toDetail(updated);
}

export async function listEditorialRequestFormCatalog() {
  const [cities, signalGroups, classChips] = await Promise.all([
    prisma.city.findMany({
      where: {
        isLegacyNonCity: false,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.signalDefinition.findMany({
      where: {
        domain: SignalDomain.DISCOVERY,
        status: SignalStatus.ACTIVE,
        parentId: null,
        entityTypes: {
          has: SignalEntityType.OFFER,
        },
      },
      include: {
        children: {
          where: {
            status: SignalStatus.ACTIVE,
            isActive: true,
          },
          orderBy: [{ order: "asc" }, { title: "asc" }],
        },
      },
      orderBy: [{ order: "asc" }, { title: "asc" }],
    }),
    listDiscoveryClassChips(),
  ]);

  const normalizedSignalGroups: EditorialSignalGroup[] = signalGroups
    .map((group) => ({
      id: group.id,
      slug: group.slug,
      title: group.title,
      options: group.children.map((option) => ({
        id: option.id,
        label: option.title,
        value: option.id,
      })),
    }))
    .filter((group) => group.options.length > 0);

  const normalizedClassChips: EditorialClassChipOption[] = classChips.map(
    (chip) => ({
      slug: chip.slug,
      title: chip.title,
    }),
  );

  return {
    cities,
    signalGroups: normalizedSignalGroups,
    classChips: normalizedClassChips,
  };
}
