import type { CollectionLeadForm } from "./collectionLeadForm";
import type { CollectionPartyMode } from "./collectionPartyLead";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class CollectionLeadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Что уже создано на сервере: повторная отправка после сбоя продолжает с того же шага, а не плодит черновики. */
export type CollectionLeadProgress = { partyId?: string; version?: number; idempotencyKey: string };

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error : "Не удалось отправить заявку";
    throw new CollectionLeadError(message, res.status);
  }
  return data;
}

/**
 * Заявка из подборки идёт через существующий Party-поток:
 * черновик → заполнение с основной услугой → отправка (создаётся BookingRequest(PARTY)).
 * Новых серверных путей нет; 401 означает «нужен вход».
 */
export async function submitCollectionLead(input: {
  offerId: string;
  citySlug: string;
  mode: CollectionPartyMode;
  form: CollectionLeadForm;
  progress: CollectionLeadProgress;
  fetchImpl?: FetchLike;
}): Promise<{ partyId: string; requestId: string | null }> {
  const f = input.fetchImpl ?? ((url, init) => fetch(url, init));
  const json = { "Content-Type": "application/json" };
  const p = input.progress;

  let alreadySubmitted = false;
  if (p.partyId) {
    // Повтор после неоднозначного сбоя (ответ потерян): сверяем фактическое состояние черновика.
    const current = await readJson(await f(`/api/parent/parties/${p.partyId}`, { method: "GET", credentials: "include", cache: "no-store" }));
    p.version = Number(current.version);
    alreadySubmitted = current.status !== "DRAFT";
  } else {
    const created = await readJson(await f("/api/parent/parties", {
      method: "POST", headers: json, credentials: "include",
      body: JSON.stringify({ citySlug: input.citySlug, venueMode: input.mode }),
    }));
    p.partyId = String(created.id);
    p.version = Number(created.version);
  }

  const { form } = input;
  if (!alreadySubmitted) {
    const updated = await readJson(await f(`/api/parent/parties/${p.partyId}`, {
      method: "PATCH", headers: json, credentials: "include",
      body: JSON.stringify({
        version: p.version,
        anchorOfferId: input.offerId,
        addonOfferIds: [],
        anchorNote: form.comment.trim() || null,
        eventDate: form.eventDate,
        timeFrom: form.timeFrom,
        timeTo: form.timeTo,
        childrenCount: form.children,
        adultsCount: form.adults,
        childAge: form.childAge,
        childName: form.childName.trim() || null,
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
      }),
    }));
    p.version = Number(updated.version);
  }
  // Отправка идемпотентна по Idempotency-Key: если заявка уже ушла, сервер вернёт её же.

  const submitted = await readJson(await f(`/api/parent/parties/${p.partyId}/submit`, {
    method: "POST", credentials: "include",
    headers: { ...json, "Idempotency-Key": p.idempotencyKey },
    body: JSON.stringify({ version: p.version }),
  }));
  const request = submitted.request as { id?: unknown } | undefined;
  return { partyId: p.partyId, requestId: typeof request?.id === "string" ? request.id : null };
}
