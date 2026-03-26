import { NextRequest, NextResponse } from "next/server";
import type { SeoEntityUpdateInput } from "./types";
import { providerForApiRoute } from "./service";
import { getCurrentUser } from "@/lib/auth/server";

function requireAdminOrModerator(user: { role: string } | null) {
  return !!user && (user.role === "ADMIN" || user.role === "MODERATOR");
}

export async function handleEntitySeoGet(
  routeKey: "activity" | "place" | "offer" | "route" | "article",
  entityId: string
) {
  const user = await getCurrentUser();
  if (!requireAdminOrModerator(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const provider = providerForApiRoute(routeKey);
  const model = await provider.loadEditorModel(entityId);
  if (!model) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entity: model });
}

export async function handleEntitySeoPatch(
  req: NextRequest,
  routeKey: "activity" | "place" | "offer" | "route" | "article",
  entityId: string
) {
  const user = await getCurrentUser();
  if (!requireAdminOrModerator(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const provider = providerForApiRoute(routeKey);
  const body = (await req.json()) as Partial<SeoEntityUpdateInput>;
  const input: SeoEntityUpdateInput = {
    slug: body.slug ?? null,
    seoTitle: body.seoTitle ?? null,
    seoDescription: body.seoDescription ?? null,
    seoH1: body.seoH1 ?? null,
    seoCanonicalUrl: body.seoCanonicalUrl ?? null,
    seoOgTitle: body.seoOgTitle ?? null,
    seoOgDescription: body.seoOgDescription ?? null,
    seoOgImage: body.seoOgImage ?? null,
    seoRobots: body.seoRobots ?? null,
    seoJsonLdOverride: body.seoJsonLdOverride ?? null,
  };
  await provider.updateSeo(entityId, input);
  return NextResponse.json({ ok: true });
}

export async function handleEntityToggleIndexation(
  _req: NextRequest,
  routeKey: "activity" | "place" | "offer" | "route" | "article",
  entityId: string
) {
  const user = await getCurrentUser();
  if (!requireAdminOrModerator(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const provider = providerForApiRoute(routeKey);
  await provider.toggleIndexation(entityId);
  return NextResponse.json({ ok: true });
}

