import { NextRequest } from "next/server";
import { bulkDeleteImportedRecords } from "../../actions";

export async function POST(request: NextRequest) {
  try {
    let importedRecordIds: string[] = [];
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { importedRecordIds?: unknown; taskIds?: unknown };
      const rawIds = body.importedRecordIds ?? body.taskIds;
      importedRecordIds = Array.isArray(rawIds)
        ? rawIds.filter((id): id is string => typeof id === "string")
        : [];
    } else if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await request.formData();
      const rawValues = [
        ...formData.getAll("importedRecordIds"),
        ...formData.getAll("taskIds"),
      ];

      importedRecordIds = rawValues.flatMap((value) => {
        if (typeof value !== "string") return [];
        return value.includes(",") ? value.split(",").map((id) => id.trim()).filter(Boolean) : [value];
      });
    }

    if (
      !Array.isArray(importedRecordIds) ||
      importedRecordIds.length === 0 ||
      importedRecordIds.some((id) => typeof id !== "string")
    ) {
      return Response.json({ success: false, error: "Invalid imported record IDs provided" });
    }

    const result = await bulkDeleteImportedRecords(importedRecordIds);

    return Response.json(result);
  } catch (error) {
    console.error("Error in bulk delete:", error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
