import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import {
  createSeoContentPlanItem,
  SeoContentPlanDuplicateError,
  SeoContentPlanValidationError,
  updateSeoContentPlanItemStatus,
} from "@/lib/admin/seo/plan/seoContentPlan.service";
import type {
  GeoScope,
  SeoContentPlanPriority,
  SeoContentPlanSource,
  SeoContentPlanStatus,
} from "@prisma/client";

const SCOPES = new Set<GeoScope>(["CITY", "REGION", "COUNTRY"]);
const STATUSES = new Set<SeoContentPlanStatus>([
  "IDEA",
  "PLANNED",
  "IN_PROGRESS",
  "PUBLISHED",
]);
const PRIORITIES = new Set<SeoContentPlanPriority>(["LOW", "MEDIUM", "HIGH"]);
const SOURCES = new Set<SeoContentPlanSource>([
  "MANUAL",
  "INTERNAL_SEARCH",
  "SEO_OPPORTUNITY",
]);

export async function POST(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const geoScope =
    typeof body.geoScope === "string" && SCOPES.has(body.geoScope as GeoScope)
      ? (body.geoScope as GeoScope)
      : null;
  if (!geoScope) {
    return NextResponse.json({ error: "geoScope required" }, { status: 400 });
  }

  try {
    const item = await createSeoContentPlanItem({
      title,
      targetQuery:
        typeof body.targetQuery === "string" ? body.targetQuery : null,
      geoScope,
      cityId: typeof body.cityId === "string" ? body.cityId : null,
      regionId: typeof body.regionId === "string" ? body.regionId : null,
      scheduledFor:
        typeof body.scheduledFor === "string" && body.scheduledFor
          ? new Date(body.scheduledFor)
          : null,
      priority:
        typeof body.priority === "string" &&
        PRIORITIES.has(body.priority as SeoContentPlanPriority)
          ? (body.priority as SeoContentPlanPriority)
          : "MEDIUM",
      source:
        typeof body.source === "string" &&
        SOURCES.has(body.source as SeoContentPlanSource)
          ? (body.source as SeoContentPlanSource)
          : "MANUAL",
      sourceQuery:
        typeof body.sourceQuery === "string" ? body.sourceQuery : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      status:
        typeof body.status === "string" &&
        STATUSES.has(body.status as SeoContentPlanStatus)
          ? (body.status as SeoContentPlanStatus)
          : "IDEA",
      createdByUserId: user.id,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    if (e instanceof SeoContentPlanValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof SeoContentPlanDuplicateError) {
      return NextResponse.json({ error: e.message, code: "DUPLICATE" }, { status: 409 });
    }
    console.error("[admin/seo/plan POST]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : null;
  const status =
    typeof body.status === "string" &&
    STATUSES.has(body.status as SeoContentPlanStatus)
      ? (body.status as SeoContentPlanStatus)
      : null;
  if (!id || !status) {
    return NextResponse.json(
      { error: "id and status required" },
      { status: 400 },
    );
  }

  try {
    const item = await updateSeoContentPlanItemStatus(id, status);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error("[admin/seo/plan PATCH]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
