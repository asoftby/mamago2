import { NextResponse } from "next/server";
import { handleWorkRequest, queryParams } from "@/server/services/work/workHttp";
import { createWorkItemSchema, workListQuerySchema } from "@/server/services/work/workSchemas";
import { createWorkItem, listWorkItems } from "@/server/services/work/workService";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleWorkRequest(request, async () => {
    const query = workListQuerySchema.parse(queryParams(request));
    return NextResponse.json(await listWorkItems(query));
  });
}

export async function POST(request: Request) {
  return handleWorkRequest(request, async (actor) => {
    const input = createWorkItemSchema.parse(await request.json());
    return NextResponse.json(await createWorkItem(actor, input), { status: 201 });
  });
}
