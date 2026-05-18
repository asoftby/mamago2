import type { Organizer, OrganizerCreatedFrom, PrismaClient } from "@prisma/client";
import { normalizePhoneToE164 } from "@/lib/phone/e164";
import { resolveCompanyByUnp } from "@/server/company/resolveByUnp";

export type OrganizerFormMode = "existing" | "import" | "manual";

export type EventOrganizerInput = {
  mode: OrganizerFormMode;
  organizerId?: string | null;
  name?: string | null;
  unp?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
};

export type OrganizerSnapshot = {
  mode: OrganizerFormMode;
  id: string | null;
  name: string;
  unp: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  createdFrom: "import" | "manual" | null;
};

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWebsite(value: string | null | undefined): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

function normalizeInstagram(value: string | null | undefined): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  const handle = cleaned.replace(/^@/, "");
  return handle.length > 0 ? `https://instagram.com/${handle}` : null;
}

function asSnapshot(
  organizer: Organizer | null,
  mode: OrganizerFormMode,
): OrganizerSnapshot | null {
  if (!organizer) return null;
  return {
    mode,
    id: organizer.id,
    name: organizer.name,
    unp: organizer.unp,
    phone: organizer.phone,
    website: organizer.website,
    instagram: organizer.instagram,
    createdFrom: organizer.createdFrom === "IMPORT" ? "import" : "manual",
  };
}

function normalizeUnp(value: string | null | undefined): string | null {
  const cleaned = typeof value === "string" ? value.replace(/\D/g, "").trim() : "";
  return /^\d{9}$/.test(cleaned) ? cleaned : null;
}

async function ensureServiceBusinessOwnerForUnp(
  prisma: PrismaClient,
  unp: string,
  legalName: string,
) {
  const email = `organizer-unp-${unp}@mamago.local`;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email,
      passwordHash: "service-account-disabled",
      role: "USER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      displayName: legalName,
    },
    select: { id: true },
  });
}

async function ensureLinkedBusinessForOrganizer(params: {
  prisma: PrismaClient;
  unp: string;
  legalName: string;
  phone: string | null;
  website: string | null;
}) {
  const existing = await params.prisma.business.findFirst({
    where: { unp: params.unp },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const owner = await ensureServiceBusinessOwnerForUnp(
    params.prisma,
    params.unp,
    params.legalName,
  );

  const created = await params.prisma.business.create({
    data: {
      ownerUserId: owner.id,
      name: params.legalName,
      legalName: params.legalName,
      unp: params.unp,
      phone: params.phone,
      verificationStatus: "DRAFT",
      status: "DRAFT",
    },
    select: { id: true },
  });

  return created.id;
}

export async function resolveEventOrganizer(
  prisma: PrismaClient,
  input: EventOrganizerInput,
): Promise<{ organizerId: string | null; organizerSnapshot: OrganizerSnapshot | null }> {
  const mode = input.mode;

  if (mode === "existing" && input.organizerId) {
    const organizer = await prisma.organizer.findUnique({
      where: { id: input.organizerId },
    });
    return {
      organizerId: organizer?.id ?? null,
      organizerSnapshot: asSnapshot(organizer, mode),
    };
  }

  const name = cleanText(input.name);
  if (!name) {
    return { organizerId: null, organizerSnapshot: null };
  }

  const unp = normalizeUnp(input.unp);
  const phone = normalizePhoneToE164(cleanText(input.phone) ?? "");
  const website = normalizeWebsite(input.website);
  const instagram = normalizeInstagram(input.instagram);
  const createdFrom: OrganizerCreatedFrom = mode === "import" ? "IMPORT" : "MANUAL";
  const existingBusinessByUnp = unp
    ? await prisma.business.findFirst({
        where: { unp },
        select: { id: true },
      })
    : null;
  const unpLookup = unp ? await resolveCompanyByUnp(unp) : { legalName: null, source: null };
  const linkedBusinessId = existingBusinessByUnp?.id
    ? existingBusinessByUnp.id
    : unp && unpLookup.legalName
      ? await ensureLinkedBusinessForOrganizer({
          prisma,
          unp,
          legalName: unpLookup.legalName,
          phone,
          website,
        })
      : null;

  const exactNameWhere = { equals: name, mode: "insensitive" as const };

  let organizer =
    (unp
      ? await prisma.organizer.findFirst({
          where: { unp },
        })
      : null) ??
    (phone
      ? await prisma.organizer.findFirst({
          where: {
            name: exactNameWhere,
            phone,
          },
        })
      : null) ??
    (website
      ? await prisma.organizer.findFirst({
          where: {
            name: exactNameWhere,
            website: { equals: website, mode: "insensitive" },
          },
        })
      : null) ??
    (instagram
      ? await prisma.organizer.findFirst({
          where: {
            name: exactNameWhere,
            instagram: { equals: instagram, mode: "insensitive" },
          },
        })
      : null) ??
    (await prisma.organizer.findFirst({
      where: {
        name: exactNameWhere,
      },
    }));

  if (organizer) {
    organizer = await prisma.organizer.update({
      where: { id: organizer.id },
      data: {
        unp: organizer.unp ?? unp,
        phone: organizer.phone ?? phone,
        website: organizer.website ?? website,
        instagram: organizer.instagram ?? instagram,
        linkedBusinessId: organizer.linkedBusinessId ?? linkedBusinessId,
        createdFrom: organizer.createdFrom === "IMPORT" ? "IMPORT" : createdFrom,
      },
    });
  } else {
    organizer = await prisma.organizer.create({
      data: {
        name,
        unp,
        phone,
        website,
        instagram,
        createdFrom,
        linkedBusinessId,
      },
    });
  }

  return {
    organizerId: organizer.id,
    organizerSnapshot: asSnapshot(organizer, mode),
  };
}

function organizerManualImportMatchesRow(
  row: Pick<Organizer, "name" | "unp" | "phone" | "website" | "instagram">,
  input: EventOrganizerInput,
): boolean {
  if (input.mode === "existing") return false;
  const name = cleanText(input.name);
  if (!name) return false;
  if (row.name.trim().toLowerCase() !== name.toLowerCase()) return false;
  const unpIn = normalizeUnp(input.unp);
  if ((row.unp ?? null) !== unpIn) return false;
  const phoneIn = normalizePhoneToE164(cleanText(input.phone) ?? "");
  const phoneRow = row.phone ?? "";
  if (phoneIn !== phoneRow) return false;
  const websiteIn = normalizeWebsite(input.website);
  const websiteRow = row.website ?? null;
  if ((websiteIn ?? null) !== (websiteRow ?? null)) return false;
  const instIn = normalizeInstagram(input.instagram);
  const instRow = row.instagram ?? null;
  if ((instIn ?? null) !== (instRow ?? null)) return false;
  return true;
}

/**
 * PATCH/event save: reuse DB organizer row when input is unchanged to avoid UNP/EGR network calls.
 */
export async function resolveEventOrganizerForPatch(
  prisma: PrismaClient,
  args: {
    existingOrganizerId: string | null;
    organizerInput: EventOrganizerInput | undefined;
  },
): Promise<{ organizerId: string | null; organizerSnapshot: OrganizerSnapshot | null }> {
  const input = args.organizerInput;
  if (!input || typeof input !== "object") {
    return { organizerId: args.existingOrganizerId, organizerSnapshot: null };
  }

  if (input.mode === "existing" && input.organizerId) {
    if (input.organizerId === args.existingOrganizerId) {
      const organizer = await prisma.organizer.findUnique({
        where: { id: input.organizerId },
      });
      return {
        organizerId: organizer?.id ?? null,
        organizerSnapshot: asSnapshot(organizer, "existing"),
      };
    }
    return resolveEventOrganizer(prisma, input);
  }

  if (args.existingOrganizerId) {
    const organizerRow = await prisma.organizer.findUnique({
      where: { id: args.existingOrganizerId },
    });
    if (organizerRow && organizerManualImportMatchesRow(organizerRow, input)) {
      return {
        organizerId: organizerRow.id,
        organizerSnapshot: asSnapshot(organizerRow, input.mode),
      };
    }
  }

  return resolveEventOrganizer(prisma, input);
}
