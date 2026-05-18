import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import {
  getLlmsTxtSnapshot,
  saveLlmsTxtSnapshot,
  SeoLlmsTxtInputSchema,
} from "@/lib/seo/llms";
import { buildAdminPath } from "@/lib/routing/surface";

export async function GET() {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const item = await getLlmsTxtSnapshot();
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[admin/seo/llms-txt GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = SeoLlmsTxtInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const item = await saveLlmsTxtSnapshot(parsed.data);

    revalidatePath("/llms.txt");
    revalidatePath(buildAdminPath("/seo"));
    revalidatePath(buildAdminPath("/seo/llms-txt"));

    return NextResponse.json({ item });
  } catch (error) {
    console.error("[admin/seo/llms-txt PUT]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
