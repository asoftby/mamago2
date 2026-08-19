import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectRiskSeverity, DirectRiskSignalType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { adminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";
import { getAdminDialogDetail } from "@/server/services/direct/directAdmin.service";
import { getDialogRiskSummary } from "@/server/services/direct/directRiskSignal.service";
import { ThreadNumber } from "@/components/direct/ThreadNumber";
import {
  BlockUnblockButtons,
  CompleteOccasionButton,
  HideMessageButton,
  SystemMessageForm,
} from "./DialogActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SENDER_LABELS: Record<string, string> = {
  CUSTOMER: "Клиент",
  BUSINESS: "Бизнес",
  SYSTEM: "Система",
  ADMIN: "Админ",
};

const SIGNAL_LABELS: Record<DirectRiskSignalType, string> = {
  CONTACT_PHONE: "Телефон",
  CONTACT_EMAIL: "Email",
  CONTACT_LINK: "Ссылка",
  CONTACT_TELEGRAM: "Telegram",
  CONTACT_WHATSAPP: "WhatsApp",
  CONTACT_INSTAGRAM: "Instagram",
  FLOOD_LOCK_TRIGGERED: "Флуд-лок",
  NO_REPLY_CAP_TRIGGERED: "Лимит без ответа",
  REPEATED_LIMIT_TRIGGERED: "Повторный нарушитель",
  COMPLAINT_OPENED: "Открыта жалоба",
  MESSAGE_HIDDEN: "Сообщение скрыто",
  THREAD_BLOCKED: "Диалог заблокирован",
};

const SEVERITY_CLASSES: Record<DirectRiskSeverity, string> = {
  LOW: "bg-stone-100 text-stone-600",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-orange-50 text-orange-700",
  CRITICAL: "bg-red-50 text-red-700",
};

const LEVEL_LABELS: Record<DirectRiskSeverity, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критичный",
};

export default async function AdminDirectDialogDetailPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const thread = await prisma.directThread.findUnique({
    where: { id: threadId },
    select: { businessId: true, customerUserId: true },
  });
  if (!thread) notFound();

  const detail = await getAdminDialogDetail(thread.businessId, thread.customerUserId);
  if (!detail) notFound();

  const isBlocked = detail.occasions.some((o) => o.status === "BLOCKED");
  const risk = await getDialogRiskSummary(detail.occasions.map((o) => o.threadId));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-stone-950">
            {detail.businessName} ↔ {detail.customerName}
          </h2>
          <p className="text-sm text-stone-500">{detail.customerEmail}</p>
        </div>
        <BlockUnblockButtons threadId={threadId} isBlocked={isBlocked} />
      </div>

      <div className="rounded-2xl border border-stone-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Безопасность диалога</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-600">Risk score: {risk.score}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", SEVERITY_CLASSES[risk.level])}>
              {LEVEL_LABELS[risk.level]}
            </span>
          </div>
        </div>
        {risk.signals.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {risk.signals.map((s) => (
              <span
                key={s.id}
                title={new Date(s.createdAt).toLocaleString("ru-RU")}
                className={cn("rounded-full px-2 py-0.5 text-xs font-medium", SEVERITY_CLASSES[s.severity])}
              >
                {SIGNAL_LABELS[s.signalType]} (+{s.score})
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-400">Risk-сигналов по этому диалогу нет</p>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200">
        <div className="border-b border-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Поводы обращения ({detail.occasions.length})
        </div>
        <div className="divide-y divide-stone-100">
          {detail.occasions.map((o) => (
            <div key={o.threadId} className="flex items-center justify-between px-4 py-2 text-sm">
              <div className="flex items-center gap-2">
                <ThreadNumber value={o.threadNumber} />
                <span className="text-stone-700">
                  {o.publicationHref ? (
                    <Link href={o.publicationHref} target="_blank" className="underline underline-offset-2">
                      {o.publicationTitle}
                    </Link>
                  ) : (
                    o.publicationTitle
                  )}
                </span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{o.status}</span>
              </div>
              {o.status === "OPEN" && <CompleteOccasionButton threadId={o.threadId} />}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200">
        <div className="border-b border-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Сообщения
        </div>
        <div className="max-h-[520px] space-y-3 overflow-y-auto px-4 py-4">
          {detail.messages.map((m) => (
            <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.hiddenAt ? "bg-red-50" : "bg-stone-50"}`}>
              <div className="flex items-center justify-between gap-2 text-xs text-stone-400">
                <span>
                  {SENDER_LABELS[m.senderType] ?? m.senderType}
                  {m.senderUserId ? ` · ${m.senderUserId}` : ""} · {new Date(m.createdAt).toLocaleString("ru-RU")}
                </span>
                {!m.hiddenAt && <HideMessageButton messageId={m.id} />}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-stone-800">{m.body}</p>
              {m.hiddenAt && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  Скрыто ({m.hiddenReason ?? "—"}) · {new Date(m.hiddenAt).toLocaleString("ru-RU")}
                </p>
              )}
            </div>
          ))}
          {detail.messages.length === 0 && <p className="text-sm text-stone-400">Сообщений нет</p>}
        </div>
      </div>

      {detail.latestOpenThreadId && (
        <div className="rounded-2xl border border-stone-200 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Системное сообщение
          </div>
          <SystemMessageForm threadId={detail.latestOpenThreadId} />
        </div>
      )}

      {detail.complaints.length > 0 && (
        <div className="rounded-2xl border border-stone-200">
          <div className="border-b border-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Жалобы по этому диалогу
          </div>
          <div className="divide-y divide-stone-100">
            {detail.complaints.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <span className="font-medium text-stone-800">{c.reason}</span>
                  <span className="ml-2 text-stone-500">{c.reporterName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{c.status}</span>
                  <Link
                    href={adminPath("/communications/direct/complaints")}
                    className="text-xs font-medium text-stone-900 underline underline-offset-2"
                  >
                    Открыть в разделе Жалобы
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
