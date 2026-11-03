import { NextResponse } from "next/server";
import { z } from "zod";
import { handleWorkRequest } from "@/server/services/work/workHttp";
import { convertCrmLeadSchema } from "@/server/services/work/workSchemas";
import { convertLead } from "@/server/services/work/workService";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return handleWorkRequest(request, async (actor) => {
    const id = z.string().cuid().parse((await context.params).id);
    const input = convertCrmLeadSchema.parse(await request.json());
    return NextResponse.json(await convertLead(actor, id, input));
  });
}
