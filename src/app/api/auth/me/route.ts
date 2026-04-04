/**
 * GET  /api/auth/me — current user
 * PATCH /api/auth/me — profile: displayName, avatarUrl, семейная персона взрослого
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { prismaToHttpResponse } from "@/lib/admin/prismaHttpErrors";
import {
  validateLeisureFormatSignalId,
  validatePreferenceSignalIds,
} from "@/lib/adultPersonaSignals/validateAdultPersonaSignals";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(user);
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const familyRoleEnum = z.enum(["MOM", "DAD", "GRANDMA", "GRANDPA", "ADULT"]);

const patchSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  // Accept both full URLs and local paths like /uploads/...
  avatarUrl: z.string().min(1).nullable().optional(),
  familyRole: familyRoleEnum.nullable().optional(),
  ageBandLabel: z.string().max(64).nullable().optional(),
  preferenceSummary: z.string().max(500).nullable().optional(),
  leisureFormatSummary: z.string().max(500).nullable().optional(),
  preferenceSignalIds: z.array(z.string().min(1)).max(3).optional(),
  leisureFormatSignalId: z.string().min(1).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data: {
      displayName?: string;
      avatarUrl?: string | null;
      familyRole?: string | null;
      ageBandLabel?: string | null;
      preferenceSummary?: string | null;
      leisureFormatSummary?: string | null;
      preferenceSignalIds?: string[];
      leisureFormatSignalId?: string | null;
    } = {};
    if (parsed.data.displayName !== undefined) data.displayName = parsed.data.displayName;
    if (parsed.data.avatarUrl !== undefined) data.avatarUrl = parsed.data.avatarUrl;
    if (parsed.data.familyRole !== undefined) data.familyRole = parsed.data.familyRole;
    if (parsed.data.ageBandLabel !== undefined) data.ageBandLabel = parsed.data.ageBandLabel;
    if (parsed.data.preferenceSummary !== undefined)
      data.preferenceSummary = parsed.data.preferenceSummary;
    if (parsed.data.leisureFormatSummary !== undefined)
      data.leisureFormatSummary = parsed.data.leisureFormatSummary;

    if (parsed.data.preferenceSignalIds !== undefined) {
      const v = await validatePreferenceSignalIds(parsed.data.preferenceSignalIds);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
      data.preferenceSignalIds = v.ids;
    }
    if (parsed.data.leisureFormatSignalId !== undefined) {
      const v = await validateLeisureFormatSignalId(parsed.data.leisureFormatSignalId);
      if (!v.ok) {
        return NextResponse.json({ error: v.error }, { status: 400 });
      }
      data.leisureFormatSignalId = v.id;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        familyRole: true,
        ageBandLabel: true,
        preferenceSummary: true,
        leisureFormatSummary: true,
        preferenceSignalIds: true,
        leisureFormatSignalId: true,
      },
    });

    const payload = {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      role: updated.role as string,
      familyRole: updated.familyRole,
      ageBandLabel: updated.ageBandLabel,
      preferenceSummary: updated.preferenceSummary,
      leisureFormatSummary: updated.leisureFormatSummary,
      preferenceSignalIds: updated.preferenceSignalIds,
      leisureFormatSignalId: updated.leisureFormatSignalId,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const mapped = prismaToHttpResponse(error);
    if (mapped) return mapped;

    console.error("[PATCH /api/auth/me] error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" ? { message } : {}),
      },
      { status: 500 },
    );
  }
}
