import type { Prisma } from "@prisma/client";
import { timeToMinutes, type ClassScheduleInput } from "@/lib/offers/offerClassSchedule";
import { localMinuteToUtc } from "./slotTime";
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
  /** Тип опубликованного оффера остаётся живым до одобрения ревизии. */
  typeChangeRequiresModeration?: boolean;
}

/**
 * Записывает режим работы, закрытые дни и ссылку внешней записи. Колонки `Offer`
 * (`bookingEnabled`, `bookingMode`, `inheritPlaceOpeningHours`) пишет роут — см. `scheduleOfferColumns`.
 * Вызывается внутри транзакции роута.
 */
export async function applyOfferSchedule(params: ApplyOfferScheduleParams): Promise<void> {
  const { db, offerId, input } = params;
  if (!input) return;
  if (params.typeChangeRequiresModeration && Object.keys(input).length > 0) {
    throw new OfferScheduleValidationError("Сначала отправьте смену типа предложения на модерацию без изменения расписания. Расписание нового типа можно настроить после одобрения.");
  }
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

  if (input.classSchedule) {
    await applyClassSchedule(db, offerId, input.classSchedule);
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
      offerBooking: {
        select: {
          externalKind: true,
          externalUrl: true,
          scheduleKind: true,
          durationMin: true,
          rules: { select: { weekday: true, startMinutes: true, capacity: true, validFrom: true, validTo: true } },
          exceptions: { select: { date: true } },
        },
      },
      sessions: { where: { isCancelled: false }, select: { startAt: true, capacity: true } },
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

const dateOnly = (key: string) => new Date(`${key}T00:00:00.000Z`);

/**
 * Расписание занятий: правила/сессии заменяются целиком по данным формы, но сессии, на которые уже есть
 * заявки, не удаляются (их отменяют флагом), чтобы не оборвать `BookingRequest.offerSessionId`.
 * Способ записи не трогаем: слоты онлайн-записи в фазе 1 скрыты.
 */
async function applyClassSchedule(db: Db, offerId: string, schedule: ClassScheduleInput): Promise<void> {
  const scheduleKind = schedule.kind === "recurring" ? "RECURRING_SESSIONS" : "DATED_SESSIONS";
  const booking = await db.offerBooking.upsert({
    where: { offerId },
    create: { offerId, scheduleKind, durationMin: schedule.durationMin },
    update: { scheduleKind, durationMin: schedule.durationMin },
    select: { id: true, timezone: true },
  });

  // Закрытые дни занятий — OfferScheduleException (решение 8 фазы 0).
  await db.offerScheduleException.deleteMany({ where: { offerBookingId: booking.id } });
  if (schedule.closedDates.length > 0) {
    await db.offerScheduleException.createMany({
      data: [...new Set(schedule.closedDates)].map((date) => ({ offerBookingId: booking.id, date: dateOnly(date) })),
    });
  }

  if (schedule.kind === "recurring") {
    // Preserve stable wizard IDs; never remove groups referenced by historical bookings.
    const existingGroups = await db.offerClassGroup.findMany({
      where: { offerId }, select: { id: true },
    });
    const wantedIds = new Set(schedule.groups.map((group) => group.id));
    for (const [position, group] of schedule.groups.entries()) {
      const existingById = existingGroups.some((item) => item.id === group.id);
      if (!existingById) {
        const ownedElsewhere = await db.offerClassGroup.findUnique({ where: { id: group.id }, select: { offerId: true } });
        if (ownedElsewhere) throw new OfferScheduleValidationError("Идентификатор группы принадлежит другому предложению");
      }
      await db.offerClassGroup.upsert({
        where: { id: group.id },
        create: { id: group.id, offerId, title: `Группа ${position + 1}`, position },
        update: { position, active: true },
      });
      const tariffs = group.tariffs ?? [];
      for (const [tariffPosition, tariff] of tariffs.entries()) {
        const old = await db.offerClassTariff.findUnique({ where: { id: tariff.id }, select: { groupId: true } });
        if (old && old.groupId !== group.id) throw new OfferScheduleValidationError("Тариф относится к другой группе");
        await db.offerClassTariff.upsert({
          where: { id: tariff.id },
          create: { id: tariff.id, groupId: group.id, title: tariff.title, price: tariff.price,
            unit: tariff.unit, periodDays: tariff.periodDays ?? null, position: tariffPosition },
          update: { title: tariff.title, price: tariff.price, unit: tariff.unit,
            periodDays: tariff.periodDays ?? null, position: tariffPosition, active: true },
        });
      }
      await db.offerClassTariff.updateMany({
        where: { groupId: group.id, id: { notIn: tariffs.map((tariff) => tariff.id) } },
        data: { active: false },
      });
    }
    await db.offerClassGroup.updateMany({
      where: { offerId, id: { in: existingGroups.filter((group) => !wantedIds.has(group.id)).map((group) => group.id) } },
      data: { active: false },
    });
    await db.offerScheduleRule.deleteMany({ where: { offerBookingId: booking.id } });

    const rows = schedule.groups.flatMap((group) => {
      const period = group.period === undefined ? schedule.period : group.period;
      const validFrom = period?.from ? dateOnly(period.from) : null;
      const validTo = period?.to ? dateOnly(period.to) : null;
      const start = timeToMinutes(group.time);
      if (start === null) return [];
      return [...new Set(group.days)].map((weekday) => ({
        offerBookingId: booking.id,
        classGroupId: group.id,
        weekday,
        startMinutes: start,
        endMinutes: start + schedule.durationMin,
        validFrom,
        validTo,
        capacity: group.seats,
      }));
    });
    // Group-specific rules are separate even when their weekday/time overlap.
    const unique = rows;
    if (unique.length > 0) await db.offerScheduleRule.createMany({ data: unique });
    // Сохраняем историю и ссылки заявок, но прежние разовые даты больше не активны.
    await db.offerSession.updateMany({ where: { offerId, isCancelled: false }, data: { isCancelled: true } });
    return;
  }

  // Regular groups no longer available when switching to dated sessions; preserve IDs for history.
  await db.offerClassGroup.updateMany({ where: { offerId, active: true }, data: { active: false } });
  // Удаляем прежнее регулярное представление при переходе к разовым датам.
  await db.offerScheduleRule.deleteMany({ where: { offerBookingId: booking.id } });
  // Разовые занятия — OfferSession по датам.
  const wanted = new Map<number, { startAt: Date; endAt: Date; capacity: number | null }>();
  for (const item of schedule.dates) {
    const start = timeToMinutes(item.time);
    if (start === null) continue;
    const startAt = localMinuteToUtc(item.date, start, booking.timezone);
    const endAt = localMinuteToUtc(item.date, start + schedule.durationMin, booking.timezone);
    if (!startAt || !endAt) throw new OfferScheduleValidationError("Некорректное время занятия");
    wanted.set(startAt.getTime(), { startAt, endAt, capacity: item.seats });
  }
  for (const row of wanted.values()) {
    await db.offerSession.upsert({
      where: { offerId_startAt: { offerId, startAt: row.startAt } },
      create: { offerId, ...row },
      update: { endAt: row.endAt, capacity: row.capacity, isCancelled: false },
    });
  }
  const existing = await db.offerSession.findMany({
    where: { offerId },
    select: { id: true, startAt: true, _count: { select: { bookingRequests: true } } },
  });
  const stale = existing.filter((row) => !wanted.has(row.startAt.getTime()));
  const removable = stale.filter((row) => row._count.bookingRequests === 0).map((row) => row.id);
  const booked = stale.filter((row) => row._count.bookingRequests > 0).map((row) => row.id);
  if (removable.length > 0) await db.offerSession.deleteMany({ where: { id: { in: removable } } });
  if (booked.length > 0) {
    await db.offerSession.updateMany({ where: { id: { in: booked } }, data: { isCancelled: true } });
  }
}
