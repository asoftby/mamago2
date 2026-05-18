import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  canDeleteImportRun,
  deleteRun,
} from "@/server/modules/import/services/import-run.service";

export const runtime = "nodejs";

function requireAdminOrEditor(role: string) {
  if (role !== "ADMIN" && role !== "MODERATOR") {
    throw new Error("Access denied");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    requireAdminOrEditor(user.role);

    const { runId } = await params;

    const check = await canDeleteImportRun(runId);

    if (!check.canDelete) {
      console.log(`[ImportRunDelete] blocked runId=${runId} reason="${check.reason}"`, check.counts);
      return NextResponse.json(
        {
          error:
            "Этот прогон нельзя удалить, потому что он связан с импортированными или опубликованными объектами.",
          reason: check.reason,
          counts: check.counts,
        },
        { status: 409 },
      );
    }

    await deleteRun(runId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[import/runs] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
