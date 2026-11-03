import { NextResponse } from "next/server";
import { handleWorkRequest, queryParams } from "@/server/services/work/workHttp";
import { createCrmLeadSchema, crmLeadListQuerySchema } from "@/server/services/work/workSchemas";
import { createLead, listLeads } from "@/server/services/work/workService";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleWorkRequest(request, async () => {
    const query = crmLeadListQuerySchema.parse(queryParams(request));
    return NextResponse.json(await listLeads(query));
  });
}

export async function POST(request: Request) {
  return handleWorkRequest(request, async (actor) => {
    const input = createCrmLeadSchema.parse(await request.json());
    return NextResponse.json(await createLead(actor, input), { status: 201 });
  });
}
