import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { setArticleJournalFlags } from "@/lib/article/articleAdminService";
import { invalidatePublicArticleLists } from "@/server/article/publicArticleCache";

const BodySchema = z
  .object({ featured: z.boolean().optional(), pinned: z.boolean().optional() })
  .strict()
  .refine((b) => b.featured !== undefined || b.pinned !== undefined, "featured or pinned required");

/** PATCH: отметки «Главное» / «Закрепить» из списка публикаций. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id } = await params;
  try {
    const row = await setArticleJournalFlags(id, parsed.data);
    invalidatePublicArticleLists();
    return NextResponse.json(row);
  } catch (e) {
    console.error("[article journal-flags]", e);
    return NextResponse.json({ error: "Не удалось обновить отметки" }, { status: 400 });
  }
}
