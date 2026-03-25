/** Единый разбор тела ответа API админки для toast. */
export function messageFromApiError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
    const inner = o.error;
    if (inner && typeof inner === "object") {
      const m = (inner as Record<string, unknown>).message;
      if (typeof m === "string") return m;
    }
  }
  return status ? `Ошибка ${status}` : "Запрос не выполнен";
}
