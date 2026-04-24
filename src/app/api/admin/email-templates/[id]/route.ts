import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { UpdateEmailTemplateBodySchema } from "@/features/email-studio/server/email-template.api";
import {
  deleteTemplate,
  getTemplateById,
  updateTemplate,
} from "@/features/email-studio/server/email-template.service";
import {
  jsonInvalidJsonError,
  jsonServiceErrorResponse,
  jsonUnauthorizedError,
  jsonValidationError,
} from "@/features/email-studio/server/email-template.http";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return jsonUnauthorizedError();
  }

  const { id } = await params;

  try {
    const template = await getTemplateById(id);
    return NextResponse.json({ template });
  } catch (error) {
    console.error("[admin/email-templates/:id GET]", error);
    return jsonServiceErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return jsonUnauthorizedError();
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonInvalidJsonError();
  }

  const parsed = UpdateEmailTemplateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const template = await updateTemplate(id, parsed.data);
    return NextResponse.json({ template });
  } catch (error) {
    console.error("[admin/email-templates/:id PATCH]", error);
    return jsonServiceErrorResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return jsonUnauthorizedError();
  }

  const { id } = await params;

  try {
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/email-templates/:id DELETE]", error);
    return jsonServiceErrorResponse(error);
  }
}
