"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RequesterRole = "OWNER" | "DIRECTOR" | "MARKETER" | "MANAGER" | "OTHER";
type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_INFO";
type AccessRequestSummary = {
  id: string;
  status: AccessRequestStatus;
  createdAt: string;
};

const ROLE_LABELS: Record<RequesterRole, string> = {
  OWNER: "Владелец",
  DIRECTOR: "Директор",
  MARKETER: "Маркетолог",
  MANAGER: "Менеджер",
  OTHER: "Другое",
};

/**
 * Compact "запросить доступ" form shown after BUSINESS_UNP_ALREADY_EXISTS.
 * Submits directly to /api/business/access-requests — does not touch or
 * reveal any data about the existing business beyond the УНП the user
 * already typed in.
 */
export function AccessRequestPanel({ unp }: { unp: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requesterRole, setRequesterRole] = useState<RequesterRole>("OWNER");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; requestId?: string } | null>(null);
  const [existingRequest, setExistingRequest] = useState<AccessRequestSummary | null>(null);
  const [statusCheckFailed, setStatusCheckFailed] = useState(false);

  // Query only this authenticated user's request; a GET never creates a request.
  // The saved status survives reloads unlike the original ephemeral success banner.
  useEffect(() => {
    if (!/^[0-9]{9}$/.test(unp)) return;
    const controller = new AbortController();
    setExistingRequest(null);
    setStatusCheckFailed(false);

    void fetch(`/api/business/access-requests?unp=${encodeURIComponent(unp)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось проверить статус заявки");
        return response.json();
      })
      .then((data: { ok: boolean; request?: AccessRequestSummary | null }) => {
        if (!controller.signal.aborted) {
          setExistingRequest(data.ok ? (data.request ?? null) : null);
          setStatusCheckFailed(!data.ok);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatusCheckFailed(true);
      });

    return () => controller.abort();
  }, [unp]);

  const canSubmit = name.trim().length >= 2 && (phone.trim() || email.trim());

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/business/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unp,
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          requesterRole,
          comment: comment.trim() || undefined,
        }),
      });
      const json = await response.json();

      if (response.ok && json.ok) {
        setResult({
          ok: true,
          requestId: typeof json.requestId === "string" ? json.requestId : undefined,
          message:
            json.message ??
            (json.alreadyPending
              ? "Заявка уже отправлена и ожидает проверки."
              : "Заявка отправлена. Мы проверим данные и свяжемся с вами."),
        });
      } else {
        setResult({
          ok: false,
          message: json.message ?? "Не удалось отправить заявку. Попробуйте ещё раз.",
        });
      }
    } catch {
      setResult({ ok: false, message: "Не удалось отправить заявку. Попробуйте ещё раз." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result?.ok) {
    return (
      <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-4" role="status">
        <p className="text-sm font-medium text-green-800">{result.message}</p>
        {result.requestId && (
          <p className="mt-2 break-all text-xs text-green-800">
            Номер сохранённой заявки: {result.requestId}
          </p>
        )}
        <p className="mt-2 text-xs text-green-800">
          После проверки статус можно увидеть здесь при повторном входе.
        </p>
      </div>
    );
  }

  if (existingRequest?.status === "PENDING" || existingRequest?.status === "APPROVED") {
    return (
      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-4" role="status">
        <p className="text-sm font-medium text-gray-900">
          {existingRequest.status === "PENDING"
            ? "Ваш запрос доступа сохранён и ожидает проверки."
            : "Ваш запрос доступа одобрен."}
        </p>
        <p className="mt-2 break-all text-xs text-gray-600">
          Номер заявки: {existingRequest.id}
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => setIsOpen(true)}
      >
        Запросить доступ
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Запрос доступа к существующей компании"
      className="mt-3 space-y-3 rounded-md border border-gray-200 p-4"
      onKeyDown={(event) => {
        // The access-request controls live inside the parent onboarding form.
        // Prevent Enter in our own inputs from submitting the onboarding form.
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          event.stopPropagation();
          void handleSubmit();
        }
      }}
    >
      <p className="text-sm font-medium text-gray-900">
        Эта компания уже зарегистрирована. Запрос доступа ещё не отправлен.
      </p>
      <p className="text-sm text-gray-600">
        Заполните данные представителя и нажмите «Отправить заявку».
        После сохранения вы получите номер заявки.
      </p>
      {statusCheckFailed && (
        <p className="text-sm text-amber-800" role="status">
          Не удалось проверить ранее отправленные заявки. Это не препятствует повторной отправке.
        </p>
      )}
      {existingRequest?.status === "REJECTED" && (
        <p className="text-sm text-amber-800">Предыдущий запрос отклонён. Можно подать новый.</p>
      )}
      {existingRequest?.status === "NEEDS_INFO" && (
        <p className="text-sm text-amber-800">
          По предыдущему запросу требуются дополнительные данные. Уточните их в комментарии.
        </p>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="access-request-name">
          Имя
        </label>
        <Input
          id="access-request-name"
          // This panel lives inside the parent registration form. Its validation
          // is handled by canSubmit/API, never by the browser's parent submit.
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="access-request-phone">
          Телефон
        </label>
        <Input
          id="access-request-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+375 29 123-45-67"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="access-request-email">
          Email
        </label>
        <Input
          id="access-request-email"
          // Avoid native email validity blocking unrelated onboarding submit.
          type="text"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="access-request-role">
          Роль в компании
        </label>
        <select
          id="access-request-role"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={requesterRole}
          onChange={(e) => setRequesterRole(e.target.value as RequesterRole)}
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="access-request-comment">
          Комментарий
        </label>
        <textarea
          id="access-request-comment"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {result && !result.ok && <p className="text-sm text-red-600">{result.message}</p>}

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => void handleSubmit()} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Отправка..." : "Отправить заявку"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
