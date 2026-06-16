"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RequesterRole = "OWNER" | "DIRECTOR" | "MARKETER" | "MANAGER" | "OTHER";

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
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requesterRole, setRequesterRole] = useState<RequesterRole>("OWNER");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const canSubmit = name.trim().length >= 2 && (phone.trim() || email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-800">{result.message}</p>
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
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-md border border-gray-200 p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="access-request-name">
          Имя
        </label>
        <Input
          id="access-request-name"
          required
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
          type="email"
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
        <Button type="submit" size="sm" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Отправка..." : "Отправить заявку"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
