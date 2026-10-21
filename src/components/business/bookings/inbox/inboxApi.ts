import { createIdempotencyKey } from "@/lib/business/bookingsInbox";

export class InboxActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** POST с JSON; серверные сообщения (409/410/422) показываем как есть. */
export async function postInboxAction(
  url: string,
  body: unknown,
  idempotencyPrefix?: string,
  idempotencyKey?: string,
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyPrefix) {
    headers["Idempotency-Key"] = idempotencyKey ?? createIdempotencyKey(idempotencyPrefix);
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: unknown; details?: unknown };
  if (!res.ok) {
    const message = typeof data.error === "string" && data.error ? data.error : "Не удалось выполнить действие";
    throw new InboxActionError(message, res.status);
  }
  return data;
}
