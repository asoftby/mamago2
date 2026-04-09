import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import {
  CreateEmailTemplateBodySchema,
} from "@/features/email-studio/server/email-template.api";
import {
  createTemplate,
  listTemplates,
} from "@/features/email-studio/server/email-template.service";
import {
  jsonInvalidJsonError,
  jsonServiceErrorResponse,
  jsonUnauthorizedError,
  jsonValidationError,
} from "@/features/email-studio/server/email-template.http";

export async function GET() {
  const user = await requireAdminOrModerator();
  if (!user) {
    return jsonUnauthorizedError();
  }

  try {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[admin/email-templates GET]", error);
    return jsonServiceErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return jsonUnauthorizedError();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonInvalidJsonError();
  }

  const parsed = CreateEmailTemplateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const template = await createTemplate(parsed.data);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("[admin/email-templates POST]", error);
    return jsonServiceErrorResponse(error);
  }
}
