import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCityTimeZone } from "@/lib/stories/getCityTimeZone";
import { zonedDateKey, zonedDayRange } from "@/lib/stories/ranges";
import { addOfferOccurrenceAction, editCanonicalStoryAction, editStoryItemAction } from "@/app/admin/content/stories/actions";
import { getWeekDays, getWeekStart } from "@/features/my-plan/lib/weekCalendar";
import { AdminStoryDateScale } from "./AdminStoryDateScale";
import { MAX_HOME_STORY_ITEMS_PER_DATE } from "@/server/stories/homeStoryItems";
import { loadPublicStoryCollections } from "@/server/stories/loadPublicStoryCollections";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ cityId?: string; date?: string; filter?: string }> };

export async function StoriesManagementPanel({ searchParams }: Props) {
  const query = await searchParams;
  const cities = await prisma.city.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
  const minsk = cities.find((city) => city.slug === "minsk");
  const cityId = cities.some((city) => city.id === query.cityId) ? query.cityId! : minsk?.id;
  if (!cityId) return <main className="p-6">Сначала добавьте активный город.</main>;
  const timeZone = getCityTimeZone(cityId);
  const today = zonedDateKey(new Date(), timeZone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : today;
  const range = zonedDayRange(date, 1, timeZone);
  const weekDays = getWeekDays(getWeekStart(date));
  const weekRange = zonedDayRange(weekDays[0]!, 7, timeZone);
  const now = new Date();
  const previewNow = date === today ? now : new Date(range.start.getTime() + 12 * 60 * 60 * 1000);
  const citySlug = cities.find((city) => city.id === cityId)?.slug ?? "minsk";
  const [items, candidates, dateCountRows, actualCollections] = await Promise.all([
    prisma.homeStoryItem.findMany({
      where: { cityId, storyDate: range.start },
      orderBy: [{ pinned: "desc" }, { manualOrder: { sort: "asc", nulls: "last" } }, { startsAt: "asc" }],
      take: 100,
    }),
    prisma.offerSession.findMany({
      where: {
        startAt: { gte: range.start, lt: range.end },
        offer: { status: "PUBLISHED", OR: [{ cityId }, { place: { cityId } }] },
        NOT: { id: { in: (await prisma.homeStoryItem.findMany({ where: { cityId, storyDate: range.start, sourceType: "OFFER" }, select: { occurrenceKey: true } })).map((x) => x.occurrenceKey) } },
      },
      orderBy: { startAt: "asc" }, take: 50,
      select: { id: true, startAt: true, endAt: true, offer: { select: { title: true, slug: true, place: { select: { title: true } } } } },
    }),
    prisma.homeStoryItem.groupBy({
      by: ["storyDate"],
      where: {
        cityId,
        storyDate: { gte: weekRange.start, lt: weekRange.end },
        status: "ACTIVE",
        placementType: { not: "EXCLUDE" },
        AND: [
          { OR: [{ sourceType: "EVENT" }, { sourceType: "OFFER", placementType: "FORCE_INCLUDE" }] },
          { OR: [{ displayFrom: null }, { displayFrom: { lte: now } }] },
          { OR: [{ displayUntil: null }, { displayUntil: { gt: now } }] },
        ],
      },
      _count: { _all: true },
      orderBy: { storyDate: "asc" },
      take: 7,
    }),
    loadPublicStoryCollections({ cityId, citySlug, now: previewNow, bypassCache: true }),
  ]);
  const dateCounts = Object.fromEntries(weekDays.map((key) => [key, 0]));
  for (const row of dateCountRows) {
    dateCounts[zonedDateKey(row.storyDate, timeZone)] = Math.min(row._count._all, MAX_HOME_STORY_ITEMS_PER_DATE);
  }
  const isShown = (item: (typeof items)[number]) => item.status === "ACTIVE"
    && item.placementType !== "EXCLUDE"
    && (item.sourceType === "EVENT" || item.placementType === "FORCE_INCLUDE")
    && (!item.displayFrom || item.displayFrom <= now)
    && (!item.displayUntil || item.displayUntil > now);
  const shown = items.filter(isShown).slice(0, MAX_HOME_STORY_ITEMS_PER_DATE);
  const inactive = items.filter((item) => !isShown(item));
  const fmt = (value: Date | null) => value?.toLocaleString("ru-RU", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) ?? "—";

  return <div className="space-y-6">
    <header className="space-y-3">
      <div><h2 className="text-xl font-semibold">Фактический состав Stories</h2><p className="text-sm text-gray-500">Здесь управляется фактический состав и порядок Stories на главной. События могут добавляться автоматически, а активности из Offers — только вручную.</p></div>
      <form className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Город<select name="cityId" defaultValue={cityId} className="mt-1 block rounded-lg border p-2">{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
        <input name="date" type="hidden" value={date} />
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">Обновить</button>
        <Link className="rounded-lg border px-3 py-2 text-sm" href={`?cityId=${cityId}&date=${today}`}>Сегодня</Link>
        <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Показывается: {shown.length}</span>
      </form>
      <AdminStoryDateScale selectedDate={date} counts={dateCounts} />
    </header>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Фактический canonical rail</h2><p className="text-sm text-gray-500">Этот состав собран тем же Stories 2.0 pipeline, который использует главная.</p>
      {actualCollections.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-gray-500">Новый rail пуст.</div> : <div className="grid gap-3 md:grid-cols-2">{actualCollections.map((collection) => <article key={collection.id} className="rounded-xl border bg-white p-3"><div className="font-semibold">{collection.title} · {collection.items.length}</div><ol className="mt-2 space-y-2 text-sm">{collection.items.map((item) => <li key={item.id} className="flex items-center justify-between gap-2"><span><span className="font-mono text-xs text-gray-400">{item.id}</span> · {item.title}</span><form action={editCanonicalStoryAction} className="flex shrink-0 gap-1"><input type="hidden" name="stableId" value={item.id}/><input type="hidden" name="cityId" value={cityId}/><input type="hidden" name="date" value={date}/><button name="action" value="up" className="rounded border px-2">↑</button><button name="action" value="down" className="rounded border px-2">↓</button><button name="action" value="pin" className="rounded border px-2">Закрепить</button><button name="action" value="exclude" className="rounded border px-2 text-red-600">Исключить</button></form></li>)}</ol></article>)}</div>}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Редакторские placements</h2>
      {shown.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-gray-500">На эту дату в Stories ничего не показывается. Выберите другую дату на шкале или добавьте активность из кандидатов.</div> :
        <div className="grid gap-3">{shown.map((item, index) => <article key={item.id} className="flex gap-3 rounded-xl border bg-white p-3">
          <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">{item.coverUrlSnapshot ? <img src={item.coverUrlSnapshot} alt="" className="h-full w-full object-cover" /> : null}</div>
          <div className="min-w-0 flex-1"><div className="font-medium">{index + 1}. {item.titleSnapshot}</div><div className="text-sm text-gray-500">{item.placementType === "AUTO" ? "Автоматически · источник Event" : "Добавлено вручную"} · {fmt(item.startsAt)}{item.pinned ? " · Закреплено" : ""}</div><Link href={item.hrefSnapshot} target="_blank" className="text-sm text-blue-600">Открыть источник ↗</Link></div>
          <form action={editStoryItemAction} className="flex flex-wrap content-start gap-1"><input type="hidden" name="id" value={item.id} />
            <button name="action" value="up" title="Выше" className="rounded border px-2 py-1">↑</button><button name="action" value="down" title="Ниже" className="rounded border px-2 py-1">↓</button>
            <button name="action" value={item.pinned ? "unpin" : "pin"} className="rounded border px-2 py-1 text-xs">{item.pinned ? "Открепить" : "Закрепить"}</button>
            <button name="action" value="exclude" className="rounded border px-2 py-1 text-xs text-red-600">Исключить</button>
          </form>
        </article>)}</div>}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Кандидаты для ручного добавления</h2><p className="text-sm text-gray-500">Поиск ограничен выбранными городом, датой и первыми 50 occurrence. Offer автоматически не включаются.</p>
      {candidates.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-gray-500">Кандидатов нет.</div> : <div className="grid gap-2">{candidates.map((session) => <article key={session.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3"><div><div className="font-medium">{session.offer.title}</div><div className="text-sm text-gray-500">{session.offer.place?.title ?? "Место не назначено"} · {fmt(session.startAt)}</div><div className="text-xs text-amber-700">Только вручную · источник Offer</div></div><form action={addOfferOccurrenceAction}><input type="hidden" name="cityId" value={cityId}/><input type="hidden" name="date" value={date}/><input type="hidden" name="sessionId" value={session.id}/><button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">Добавить в Stories</button></form></article>)}</div>}
    </section>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Исключены и неактивны</h2>{inactive.length === 0 ? <p className="text-sm text-gray-500">Нет элементов.</p> : <div className="grid gap-2">{inactive.map((item) => <article key={item.id} className="flex items-center justify-between rounded-xl border bg-gray-50 p-3"><div><div className="font-medium">{item.titleSnapshot}</div><div className="text-sm text-gray-500">{item.inactiveReason ?? "Исключено вручную"}</div></div>{item.sourceType === "EVENT" ? <form action={editStoryItemAction}><input type="hidden" name="id" value={item.id}/><button name="action" value="auto" className="rounded border px-3 py-2 text-sm">Вернуть в AUTO</button></form> : null}</article>)}</div>}</section>

  </div>;
}
