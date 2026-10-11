"use client";

import type { BirthdayCatalogItem } from "../../lib/realCatalog";
import { catalogPriceSummary } from "../../lib/catalogSelection";

export function StepReview({ offers }: { offers: BirthdayCatalogItem[] }) {
  const total = catalogPriceSummary(offers);

  return (
    <section className="mx-auto max-w-3xl space-y-7">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-orange-700">Шаг 5 · предварительный план</p>
        <h2 className="text-3xl font-semibold sm:text-5xl">Вы выбрали услуги</h2>
        <p className="text-stone-600">
          Это предварительный подбор, а не оформленный заказ. Ни один исполнитель ещё не получил заявку;
          доступность даты, время и стоимость не подтверждены.
        </p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-stone-200">
        {offers.map((offer, index) => (
          <div key={offer.id} className={"flex items-center justify-between gap-4 p-5 " +
            (index > 0 ? "border-t border-stone-200" : "")}>
            <div className="min-w-0">
              <p className="text-sm text-stone-500">{offer.businessName}</p>
              <h3 className="font-semibold">{offer.title}</h3>
              {offer.productType === "PARTY_PACKAGE" && offer.includedCategories.length > 0 && (
                <p className="mt-1 text-xs text-stone-500">Включено несколько услуг в пакет</p>
              )}
            </div>
            <div className="shrink-0 font-semibold">
              {offer.priceFrom == null ? "По запросу" : "От " + offer.priceFrom.toLocaleString("ru-RU") + " " + offer.currency}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-stone-100 p-5">
        <p className="text-sm text-stone-600">Предварительная сумма известных начальных цен</p>
        <p className="mt-1 text-2xl font-bold">
          {total.minimumByn > 0 ? "От " + total.minimumByn.toLocaleString("ru-RU") + " BYN" : "Стоимость уточняется"}
        </p>
        {total.hasUnknownPrices && (
          <p className="mt-2 text-sm text-stone-600">Некоторые услуги рассчитываются индивидуально и в эту сумму не включены.</p>
        )}
      </div>
      <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 p-5">
        <h3 className="font-semibold">Оформление заявок пока недоступно</h3>
        <p className="text-sm leading-6 text-stone-700">
          Мы подключаем сохранение праздника и согласование с исполнителями.
          Сейчас вы можете посмотреть опубликованные предложения, но отправить их бизнесу пока нельзя.
        </p>
      </div>
    </section>
  );
}
