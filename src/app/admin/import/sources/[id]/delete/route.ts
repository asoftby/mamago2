import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import {
  deleteImportSourceHard,
  getImportSourceDeletionSummary,
} from "@/server/modules/import/services/import-source.service";

function canManageImport(role: string) {
  return role === "ADMIN" || role === "MODERATOR";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageImport(user.role)) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const force = body.force === true;

    const summary = await getImportSourceDeletionSummary(id);

    if (!force) {
      return Response.json({
        success: true,
        requiresConfirmation: summary.hasDependencies,
        summary,
      });
    }

    const deletedSummary = await deleteImportSourceHard(id);

    revalidatePath("/admin/import");
    revalidatePath("/admin/import/sources");
    revalidatePath("/admin/import/runs");
    revalidatePath("/admin/import/review");

    return Response.json({
      success: true,
      deleted: true,
      summary: deletedSummary,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
