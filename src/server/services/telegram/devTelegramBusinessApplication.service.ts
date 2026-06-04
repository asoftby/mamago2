import "server-only";

import { prismaBase } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification.service";

function buildApplicationBody(params: {
  applicationNumber: string;
  serviceName: string;
  clientName: string;
  scheduledFor: Date;
}): string {
  return [
    `Номер заявки: ${params.applicationNumber}`,
    `Услуга: ${params.serviceName}`,
    `Клиент: ${params.clientName}`,
    `Дата/время: ${params.scheduledFor.toLocaleString("ru-RU")}`,
  ].join("\n");
}

export async function createDevBusinessApplicationAndNotify(params: {
  userId: string;
  applicationNumber?: string;
  serviceName?: string;
  clientName?: string;
  scheduledFor?: Date;
}) {
  const application = await prismaBase.devTelegramBusinessApplication.create({
    data: {
      userId: params.userId,
      applicationNumber:
        params.applicationNumber ?? `DEV-${Date.now().toString().slice(-6)}`,
      serviceName: params.serviceName ?? "Размещение в подборке",
      clientName: params.clientName ?? "Тестовый клиент",
      scheduledFor: params.scheduledFor ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const notification = await createNotification({
    userId: params.userId,
    audience: "BUSINESS",
    type: "BUSINESS_APPLICATION_CREATED",
    title: "Новая заявка",
    body: buildApplicationBody(application),
    entityType: "BUSINESS_PROFILE",
    entityId: application.id,
  });

  return { application, notification };
}

export async function getDevBusinessApplication(applicationId: string) {
  return prismaBase.devTelegramBusinessApplication.findUnique({
    where: { id: applicationId },
  });
}

export async function confirmDevBusinessApplication(applicationId: string) {
  return prismaBase.devTelegramBusinessApplication.update({
    where: { id: applicationId },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      rejectedAt: null,
    },
  });
}

export async function rejectDevBusinessApplication(applicationId: string) {
  return prismaBase.devTelegramBusinessApplication.update({
    where: { id: applicationId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      confirmedAt: null,
    },
  });
}
