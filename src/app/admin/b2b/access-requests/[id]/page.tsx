import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { adminPath } from "@/lib/routing/surface";
import { Button } from "@/components/ui/button";
import { approveAccessRequestAction, rejectAccessRequestAction } from "../actions";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "На проверке",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  NEEDS_INFO: "Нужны данные",
};

export default async function BusinessAccessRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const request = await prisma.businessAccessRequest.findUnique({
    where: { id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          legalName: true,
          unp: true,
          owner: { select: { id: true, email: true } },
        },
      },
      requesterUser: { select: { id: true, email: true } },
      reviewedByAdmin: { select: { email: true } },
    },
  });

  if (!request) {
    notFound();
  }

  const canReview = user?.role === "ADMIN" && request.status === "PENDING";

  return (
    <div className="p-6 md:p-4 space-y-6 max-w-3xl">
      <Link
        href={adminPath("/b2b/access-requests")}
        className="text-sm text-primary hover:text-primary/80"
      >
        ← К списку заявок
      </Link>

      <div>
        <h1 className="text-2xl md:text-xl font-bold">Заявка на доступ к бизнесу</h1>
        <p className="text-gray-500 text-sm mt-1">
          {request.createdAt.toLocaleString("ru-RU")}
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-500">Статус</div>
          <div className="mt-1">{STATUS_LABELS[request.status]}</div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-500">УНП</div>
          <div className="mt-1">{request.unp}</div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-500">Бизнес</div>
          <div className="mt-1">
            {request.business.legalName || request.business.name}
            {" — "}
            <Link
              href={adminPath(`/b2b/partners/${request.business.id}`)}
              className="text-primary hover:text-primary/80"
            >
              открыть бизнес
            </Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-500">Текущий владелец бизнеса</div>
          <div className="mt-1">{request.business.owner.email}</div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-500">Заявитель</div>
          <div className="mt-1">
            {request.name} ({request.requesterUser.email})
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-500">Контакты</div>
          <div className="mt-1">
            {request.phone || "—"} {request.email ? `· ${request.email}` : ""}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-500">Роль в компании</div>
          <div className="mt-1">{request.requesterRole}</div>
        </div>

        {request.comment && (
          <div>
            <div className="text-sm font-medium text-gray-500">Комментарий</div>
            <div className="mt-1 whitespace-pre-wrap">{request.comment}</div>
          </div>
        )}

        {request.reviewedAt && (
          <div>
            <div className="text-sm font-medium text-gray-500">Проверено</div>
            <div className="mt-1">
              {request.reviewedAt.toLocaleString("ru-RU")}
              {request.reviewedByAdmin ? ` — ${request.reviewedByAdmin.email}` : ""}
            </div>
          </div>
        )}
      </div>

      {canReview && (
        <div className="flex gap-3">
          <form action={approveAccessRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <Button type="submit">Одобрить</Button>
          </form>
          <form action={rejectAccessRequestAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <Button type="submit" variant="outline">
              Отклонить
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
