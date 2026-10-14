import type { Prisma } from "@prisma/client";
import { mapToCreatePayload, mapToUpdatePayload, validateOpeningHours } from "@/lib/openingHours";
import type { OpeningHoursData } from "@/components/openingHours/openingHours.types";
import {
  bookingColumnsForMethod,
  normalizeClosedDates,
  validateExternalUrl,
  type OfferScheduleInput,
} from "@/lib/offers/offerSchedule";

export class OfferScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfferScheduleValidationError";
  }
}

/** Ссылка внешней записи у опубликованного оффера — внешний URL, то есть контент (решение 2 фазы 0). */
export class OfferExternalUrlRequiresModerationError extends Error {
  constructor() {
    super("Внешняя ссылка опубликованного предложения проходит модерацию");
    this.name = "OfferExternalUrlRequiresModerationError";
  }
}

/**
 * Колонки `Offer`, которые расписание меняет напрямую. Идут в общий `updateData` роута, чтобы
 * проходить проверку опубликованных офферов по полям и попадать в журнал операционных правок.
 */
export function scheduleOfferColumns(input: OfferScheduleInput | undefined): {
  bookingEnabled?: boolean;
  bookingMode?: "NONE" | "REQUEST_ONLY" | "EXTERNAL";
  inheritPlaceOpeningHours?: boolean;
} {
  if (!input) return {};
  const columns: ReturnType<typeof scheduleOfferColumns> = {};
  if (input.bookingMethod) Object.assign(columns, bookingColumnsForMethod(input.bookingMethod));
  if (input.hours) columns.inheritPlaceOpeningHours = input.hours.source === "place";
  return columns;
}

/** Проверка до записи: чтобы ошибка не оставила оффер наполовину сохранённым. */
export function assertScheduleValid(input: OfferScheduleInput | undefined): void {
  if (!input) return;
  if (input.bookingMethod === "EXTERNAL") {
    const error = validateExternalUrl(input.external?.url ?? "");
    if (error) throw new OfferScheduleValidationError(error);
  }
  if (input.hours?.source === "own") {
    const validation = validateOpeningHours(input.hours.data as OpeningHoursData);
    if (!validation.valid) {
      throw new OfferScheduleValidationError(validation.errors[0]?.message ?? "Некорректный режим работы");
    }
  }
}

type Db = Prisma.TransactionClient;

export interface ApplyOfferScheduleParams {
  db: Db;
  offerId: string;
  input: OfferScheduleInput | undefined;
  /** Опубликованный оффер, который правит не сотрудник: ссылку менять напрямую нельзя. */
  externalUrlNeedsModeration: boolean;
}

/**
 * Записывает режим работы, закрытые дни и ссылку внешней записи. Колонки `Offer`
 * (`bookingEnabled`, `bookingMode`, `inheritPlaceOpeningHours`) пишет роут — см. `scheduleOfferColumns`.
 * Вызывается внутри транзакции роута.
 */
export async function applyOfferSchedule(params: ApplyOfferScheduleParams): Promise<void> {
  const { db, offerId, input } = params;
  if (!input) return;
  assertScheduleValid(input);

  if (input.bookingMethod) {
    const existing = await db.offerBooking.findUnique({
      where: { offerId },
      select: { externalKind: true, externalUrl: true },
    });

    if (input.bookingMethod === "EXTERNAL" && input.external) {
      const nextUrl = input.external.url.trim();
      if (params.externalUrlNeedsModeration && nextUrl !== (existing?.externalUrl ?? "")) {
        throw new OfferExternalUrlRequiresModerationError();
      }
      await db.offerBooking.upsert({
        where: { offerId },
        create: { offerId, externalKind: input.external.kind, externalUrl: nextUrl },
        update: { externalKind: input.external.kind, externalUrl: nextUrl },
      });
    }
    // NONE / REQUEST_ONLY: ссылку не стираем — вернувшись к «Своей ссылке», партнёр найдёт прежнюю.
  }

  if (input.hours?.source === "own") {
    const data = input.hours.data as OpeningHoursData;
    const offer = await db.offer.findUniqueOrThrow({ where: { id: offerId }, select: { openingHoursId: true } });

    let openingHoursId = offer.openingHoursId;
    if (openingHoursId) {
      await db.openingHours.update({ where: { id: openingHoursId }, data: mapToUpdatePayload(data) });
    } else {
      const created = await db.openingHours.create({ data: mapToCreatePayload(data), select: { id: true } });
      openingHoursId = created.id;
      await db.offer.update({ where: { id: offerId }, data: { openingHoursId } });
    }

    // Заменяем только закрытые целиком дни; прочие исключения (особые часы) не трогаем.
    const closedDates = normalizeClosedDates(input.hours.closedDates);
    await db.openingHoursException.deleteMany({
      where: { openingHoursId, isClosed: true, allDay: true },
    });
    if (closedDates.length > 0) {
      const taken = await db.openingHoursException.findMany({
        where: { openingHoursId, date: { in: closedDates } },
        select: { date: true },
      });
      const takenDates = new Set(taken.map((row) => row.date));
      const toCreate = closedDates.filter((date) => !takenDates.has(date));
      if (toCreate.length > 0) {
        await db.openingHoursException.createMany({
          data: toCreate.map((date) => ({ openingHoursId, date, isClosed: true, allDay: true })),
        });
      }
    }
  }
}

/** Срез расписания для журнала операционных правок (до/после). */
export async function snapshotOfferSchedule(db: Db, offerId: string): Promise<Prisma.InputJsonValue> {
  const offer = await db.offer.findUniqueOrThrow({
    where: { id: offerId },
    select: {
      bookingEnabled: true,
      bookingMode: true,
      inheritPlaceOpeningHours: true,
      offerBooking: { select: { externalKind: true, externalUrl: true } },
      openingHours: {
        select: {
          mode: true,
          rules: { select: { dayOfWeek: true, allDay: true, intervals: { select: { startTime: true, endTime: true } } } },
          exceptions: { select: { date: true, isClosed: true, allDay: true } },
        },
      },
    },
  });
  return JSON.parse(JSON.stringify(offer)) as Prisma.InputJsonValue;
}
