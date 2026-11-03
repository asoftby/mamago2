import { NextResponse } from "next/server";
import { z } from "zod";
import { handleWorkRequest } from "@/server/services/work/workHttp";
import { appendWorkActivitySchema } from "@/server/services/work/workSchemas";
import { appendWorkActivity } from "@/server/services/work/workService";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return handleWorkRequest(request, async (actor) => {
    const id = z.string().cuid().parse((await context.params).id);
    const input = appendWorkActivitySchema.parse(await request.json());
    return NextResponse.json(await appendWorkActivity(actor, id, input), { status: 201 });
  });
}
