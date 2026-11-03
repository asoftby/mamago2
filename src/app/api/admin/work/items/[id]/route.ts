import { NextResponse } from "next/server";
import { z } from "zod";
import { handleWorkRequest } from "@/server/services/work/workHttp";
import { updateWorkItemSchema } from "@/server/services/work/workSchemas";
import { getWorkItem, updateWorkItem } from "@/server/services/work/workService";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return handleWorkRequest(request, async () => {
    const id = z.string().cuid().parse((await context.params).id);
    return NextResponse.json(await getWorkItem(id));
  });
}

export async function PATCH(request: Request, context: Context) {
  return handleWorkRequest(request, async (actor) => {
    const id = z.string().cuid().parse((await context.params).id);
    const input = updateWorkItemSchema.parse(await request.json());
    return NextResponse.json(await updateWorkItem(actor, id, input));
  });
}
