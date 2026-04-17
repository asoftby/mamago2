/**
 * Admin Media API - List endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getAdminMediaList } from "@/server/services/media/media-query.service";
import { getMediaStats } from "@/server/services/media/media.service";
import { MediaAssetKind, MediaAssetStatus, MediaSourceType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse filters
    const filters: {
      kind?: MediaAssetKind;
      status?: MediaAssetStatus;
      sourceType?: MediaSourceType;
      isOrphan?: boolean;
      isOrphaned?: boolean;
      uploadedById?: string;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {};

    const kind = searchParams.get("kind");
    if (kind) filters.kind = kind as MediaAssetKind;

    const status = searchParams.get("status");
    if (status) filters.status = status as MediaAssetStatus;

    const sourceType = searchParams.get("sourceType");
    if (sourceType) filters.sourceType = sourceType as MediaSourceType;

    const uploadedById = searchParams.get("uploadedById");
    if (uploadedById) filters.uploadedById = uploadedById;

    const isOrphaned = searchParams.get("isOrphaned");
    if (isOrphaned) filters.isOrphaned = isOrphaned === "true";

    const search = searchParams.get("search");
    if (search) filters.search = search;

    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = new Date(dateFrom);

    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = new Date(dateTo);

    // Parse pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Parse sort
    const sortField = searchParams.get("sortField") as "createdAt" | "updatedAt" | "filename" | "sizeBytes" | null;
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" | null;

    const result = await getAdminMediaList(
      filters,
      { page, limit },
      { field: sortField, order: sortOrder }
    );

    // Get stats if requested
    const includeStats = searchParams.get("includeStats") === "true";
    const stats = includeStats ? await getMediaStats() : null;

    return NextResponse.json({
      ...result,
      stats,
    });
  } catch (error: unknown) {
    console.error("Error fetching media list:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch media" },
      { status: 500 }
    );
  }
}
