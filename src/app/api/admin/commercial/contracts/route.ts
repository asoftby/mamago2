import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireAdminApiUser } from "@/lib/auth/requireAdminApi";
import { normalizePhoneToE164 } from "@/lib/phone/e164";
import { resolveCompanyByUnp } from "@/server/company/resolveByUnp";

export const runtime = "nodejs";

const optionalText = z.string().trim().max(500).optional().default("");

const CreateContractWizardSchema = z.object({
  templateSource: z.enum(["MAMAGO", "CLIENT"]),
  client: z.object({
    unp: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d{9}$/.test(value), "УНП должен содержать 9 цифр"),
    name: z.string().trim().min(2, "Укажите название клиента").max(300),
    contactName: optionalText,
    phoneE164: z.string().trim().max(32).optional().default(""),
  }),
  contractNumber: z.string().trim().min(1, "Укажите номер договора").max(100),
  signedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата договора"),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Укажите название услуги").max(300),
        amount: z.number().finite().positive("Сумма должна быть больше нуля").max(1_000_000_000),
      }),
    )
    .min(1, "Добавьте хотя бы одну услугу")
    .max(100),
  prepaymentPercent: z.number().int().min(0).max(100),
  prepaymentDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  postpaymentDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentComment: z.string().trim().max(2000).optional().default(""),
});

function localDateToUtc(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = CreateContractWizardSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Проверьте данные договора",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const unp = input.client.unp.replace(/\D/g, "");
    const rawPhone = input.client.phoneE164.trim();
    const phoneE164 =
      rawPhone && rawPhone !== "+375" ? normalizePhoneToE164(rawPhone) : "";

    if (rawPhone && rawPhone !== "+375" && !phoneE164) {
      return NextResponse.json(
        { error: "Введите телефон в корректном формате" },
        { status: 400 },
      );
    }

    const egr = unp
      ? await resolveCompanyByUnp(unp).catch(() => ({ legalName: null, source: null }))
      : { legalName: null, source: null };

    const normalizedItems = input.items.map((item) => ({
      name: item.name,
      amount: Math.round(item.amount * 100) / 100,
    }));
    const totalAmount =
      normalizedItems.reduce(
        (sumCents, item) => sumCents + Math.round(item.amount * 100),
        0,
      ) / 100;

    const signedAt = localDateToUtc(input.signedAt);
    const prepaymentDueAt = input.prepaymentDueAt
      ? localDateToUtc(input.prepaymentDueAt)
      : null;
    const postpaymentDueAt = input.postpaymentDueAt
      ? localDateToUtc(input.postpaymentDueAt)
      : null;

    if (input.prepaymentPercent > 0 && !prepaymentDueAt) {
      return NextResponse.json(
        { error: "Укажите срок предоплаты" },
        { status: 400 },
      );
    }

    if (input.prepaymentPercent < 100 && !postpaymentDueAt) {
      return NextResponse.json(
        { error: input.prepaymentPercent > 0 ? "Укажите срок постоплаты" : "Укажите срок оплаты" },
        { status: 400 },
      );
    }

    const paymentBaseDate =
      input.prepaymentPercent > 0 ? prepaymentDueAt : signedAt;
    if (
      postpaymentDueAt &&
      paymentBaseDate &&
      postpaymentDueAt.getTime() < paymentBaseDate.getTime()
    ) {
      return NextResponse.json(
        { error: "Срок постоплаты не может быть раньше базовой даты оплаты" },
        { status: 400 },
      );
    }

    const contract = await prisma.$transaction(async (tx) => {
      const linkedBusiness = unp
        ? await tx.business.findUnique({
            where: { unp },
            select: { id: true },
          })
        : null;

      let counterparty;

      if (unp) {
        const byUnp = await tx.commercialCounterparty.findUnique({
          where: { unp },
        });

        if (byUnp) {
          counterparty = await tx.commercialCounterparty.update({
            where: { id: byUnp.id },
            data: {
              name: input.client.name,
              contactName: input.client.contactName || null,
              phoneE164: phoneE164 || null,
              businessId: byUnp.businessId ?? linkedBusiness?.id ?? null,
              egrVerifiedAt: egr.legalName ? new Date() : byUnp.egrVerifiedAt,
              egrSource: egr.source ?? byUnp.egrSource,
            },
          });
        } else if (linkedBusiness) {
          const byBusiness = await tx.commercialCounterparty.findUnique({
            where: { businessId: linkedBusiness.id },
          });

          if (byBusiness) {
            counterparty = await tx.commercialCounterparty.update({
              where: { id: byBusiness.id },
              data: {
                unp,
                name: input.client.name,
                contactName: input.client.contactName || null,
                phoneE164: phoneE164 || null,
                egrVerifiedAt: egr.legalName ? new Date() : byBusiness.egrVerifiedAt,
                egrSource: egr.source ?? byBusiness.egrSource,
              },
            });
          } else {
            counterparty = await tx.commercialCounterparty.create({
              data: {
                unp,
                name: input.client.name,
                contactName: input.client.contactName || null,
                phoneE164: phoneE164 || null,
                businessId: linkedBusiness.id,
                egrVerifiedAt: egr.legalName ? new Date() : null,
                egrSource: egr.source,
              },
            });
          }
        } else {
          counterparty = await tx.commercialCounterparty.create({
            data: {
              unp,
              name: input.client.name,
              contactName: input.client.contactName || null,
              phoneE164: phoneE164 || null,
              egrVerifiedAt: egr.legalName ? new Date() : null,
              egrSource: egr.source,
            },
          });
        }
      } else {
        counterparty = await tx.commercialCounterparty.create({
          data: {
            name: input.client.name,
            contactName: input.client.contactName || null,
            phoneE164: phoneE164 || null,
          },
        });
      }

      return tx.businessContract.create({
        data: {
          // Wizard contracts are commercial-client documents, not an
          // implicit platform-access grant. A matching mamaGo Business is linked
          // through CommercialCounterparty.businessId instead.
          businessId: null,
          counterpartyId: counterparty.id,
          contractNumber: input.contractNumber,
          type: "MASTER",
          templateSource: input.templateSource,
          status: "ACTIVE",
          signedAt,
          startsAt: signedAt,
          endsAt: null,
          totalAmount,
          currency: "BYN",
          prepaymentPercent: input.prepaymentPercent,
          prepaymentDueAt,
          postpaymentDueAt,
          paymentComment: input.paymentComment || null,
          platform: "MAMAGO_BY",
          items: {
            create: normalizedItems.map((item, index) => ({
              name: item.name,
              amount: item.amount,
              sortOrder: index,
            })),
          },
        },
        include: {
          counterparty: true,
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    revalidatePath("/admin/commercial/contracts");

    return NextResponse.json({
      ok: true,
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        counterparty: contract.counterparty,
        totalAmount: contract.totalAmount.toString(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");

      if (target.includes("contractNumber")) {
        return NextResponse.json(
          { error: "Договор с таким номером уже существует" },
          { status: 409 },
        );
      }

      if (target.includes("unp")) {
        return NextResponse.json(
          { error: "Контрагент с таким УНП уже существует. Повторите сохранение." },
          { status: 409 },
        );
      }
    }

    console.error("[admin/commercial/contracts] create failed", error);
    return NextResponse.json(
      { error: "Не удалось создать договор" },
      { status: 500 },
    );
  }
}
