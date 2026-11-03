import { NextResponse } from "next/server";
import { z } from "zod";
import { handleWorkRequest } from "@/server/services/work/workHttp";
import { updateCrmLeadSchema } from "@/server/services/work/workSchemas";
import { updateLead } from "@/server/services/work/workService";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return handleWorkRequest(request, async (actor) => {
    const id = z.string().cuid().parse((await context.params).id);
    const input = updateCrmLeadSchema.parse(await request.json());
    return NextResponse.json(await updateLead(actor, id, input));
  });
}
