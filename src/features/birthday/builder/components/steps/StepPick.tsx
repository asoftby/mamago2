"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { BirthdayCatalogItem, PartyCategoryKey } from "../../lib/realCatalog";
import type { PlaceType } from "../../types/builder";
import { catalogPriceLabel, eligibleAddons, isAllowedBase } from "../../lib/catalogSelection";

const GROUPS: { title: string; categories: PartyCategoryKey[] }[] = [
  { title: "Аниматоры и программы", categories: ["ANIMATOR", "SHOW", "MASTER_CLASS", "PROGRAM"] },
  { title: "Торт и угощения", categories: ["CAKE", "FOOD"] },
  { title: "Оформление и фотографии", categories: ["DECOR", "PHOTO"] },
  { title: "Другие услуги", categories: ["OTHER"] },
];

type Props = {
  citySlug: string;
  offers: BirthdayCatalogItem[];
  allOfferCount: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  placeType: PlaceType | null;
  selectedBaseId: string | null;
  selectedAddonIds: string[];
  onSelectBase: (id: string) => void;
  onToggleAddon: (id: string) => void;
};

const priceLabel = catalogPriceLabel;

function OfferCard({
  offer, selected, onToggle, type,
}: { offer: BirthdayCatalogItem; selected: boolean; onToggle: () => void; type: "base" | "addon" }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <article className={"overflow-hidden rounded-2xl border bg-white transition-shadow " +
      (selected ? "border-primary shadow-md" : "border-stone-200 hover:shadow-sm")}>
      <div className="relative h-36 bg-gradient-to-br from-brand-soft via-stone-100 to-stone-200">
        {offer.coverImage ? (
          <Image src={offer.coverImage} alt="" fill sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-stone-500">
            Фото не добавлено
          </div>
        )}
        {offer.productType === "PARTY_PACKAGE" && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold">
            Готовый пакет
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs text-stone-500">{offer.businessName} · {offer.placeTitle}</p>
          <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-stone-950">{offer.title}</h3>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-stone-900">{priceLabel(offer)}</span>
          <button type="button" onClick={onToggle} aria-pressed={selected}
            className={"rounded-full px-4 py-2 text-sm font-semibold " +
              (selected ? "bg-stone-900 text-white" : "bg-primary text-white")}>
            {selected ? "Выбрано" : type === "base" ? "Выбрать основу" : "Добавить"}
          </button>
        </div>
        {offer.productType === "PARTY_PACKAGE" && offer.includedCategories.length > 0 && (
          <p className="text-xs leading-5 text-stone-600">
            Включены категории: {offer.includedCategories.map((c) => ({
              VENUE:"площадка", ANIMATOR:"аниматор", SHOW:"шоу", MASTER_CLASS:"мастер-класс",
              CAKE:"торт", FOOD:"еда", DECOR:"декор", PHOTO:"фото", PROGRAM:"программа", OTHER:"услуги",
            })[c]).join(", ")}
          </p>
        )}
        <button type="button" onClick={() => setDetailsOpen((value) => !value)}
          aria-expanded={detailsOpen} className="text-sm font-medium text-stone-600 underline underline-offset-4">
          {detailsOpen ? "Скрыть условия" : "Условия предложения"}
        </button>
        {detailsOpen && (
          <div className="space-y-1 border-t pt-3 text-sm leading-6 text-stone-700">
            <p>Предварительная стоимость: {priceLabel(offer)}. Точную цену и доступность подтверждает бизнес.</p>
            {offer.minChildren != null && <p>Минимум детей: {offer.minChildren}</p>}
            {offer.maxChildren != null && <p>Максимум детей: {offer.maxChildren}</p>}
            {offer.prepaymentTerms && <p>Предоплата: {offer.prepaymentTerms}</p>}
            {offer.cancellationTerms && <p>Отмена: {offer.cancellationTerms}</p>}
          </div>
        )}
      </div>
    </article>
  );
}

export function StepPick({
  citySlug, offers, allOfferCount, loading, error, onRetry, placeType,
  selectedBaseId, selectedAddonIds, onSelectBase, onToggleAddon,
}: Props) {
  const venueMode = placeType === "VENUE" || placeType === "PACKAGE";
  const bases = offers.filter((offer) => isAllowedBase(offer, placeType));
  const additions = eligibleAddons(offers, selectedBaseId, placeType);

  if (loading) return <section className="mx-auto max-w-3xl py-16 text-center"
    role="status">Загружаем опубликованные предложения организаторов…</section>;

  if (error) return (
    <section className="mx-auto max-w-3xl space-y-4 py-16 text-center" role="alert">
      <h2 className="text-2xl font-semibold">Каталог временно недоступен</h2>
      <p className="text-stone-600">{error}. Заявки не отправлены.</p>
      <button className="rounded-full bg-stone-900 px-6 py-3 text-white" onClick={onRetry}>Повторить загрузку</button>
    </section>
  );

  if (offers.length === 0) return (
    <section className="mx-auto max-w-3xl space-y-4 py-16 text-center">
      <h2 className="text-3xl font-semibold">
        {allOfferCount === 0 ? "Пока нет опубликованных предложений" : "По выбранным условиям нет предложений"}
      </h2>
      <p className="text-stone-600">
        {allOfferCount === 0
          ? "Для этого города ещё нет одобренных услуг."
          : "Попробуйте изменить бюджет или параметры праздника на предыдущем шаге."}
        {" "}Никаких бронирований и подтверждений не создано.
      </p>
      <Link className="inline-flex rounded-full bg-stone-900 px-6 py-3 text-white"
        href={"/" + citySlug + "/birthday"}>Посмотреть раздел праздников</Link>
    </section>
  );

  const baseTitle = venueMode ? "Выберите площадку или готовый пакет" : "Выберите основную услугу или выездной пакет";
  return (
    <section className="space-y-9" aria-label="Реальные предложения для праздника">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-primary">Шаг 4 · подбор услуг</p>
        <h2 className="text-3xl font-semibold leading-tight sm:text-5xl">Соберите ваш праздник</h2>
        <p className="max-w-2xl text-stone-600">
          Только опубликованные предложения бизнеса. Цены предварительные;
          дата, время и окончательная стоимость пока не подтверждены.
        </p>
      </header>
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">{baseTitle}</h3>
        {bases.length === 0 ? (
          <p className="rounded-xl bg-stone-100 p-5 text-stone-600">
            Для выбранного формата подходящей основной услуги не найдено. Вернитесь к формату или измените бюджет.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {bases.map((offer) => (
              <OfferCard key={offer.id} offer={offer} selected={selectedBaseId === offer.id}
                onToggle={() => onSelectBase(offer.id)} type="base" />
            ))}
          </div>
        )}
      </div>
      {selectedBaseId && GROUPS.map((group) => {
        const groupOffers = additions.filter((offer) => offer.category && group.categories.includes(offer.category));
        if (groupOffers.length === 0) return null;
        return (
          <div key={group.title} className="space-y-4">
            <h3 className="text-xl font-semibold">{group.title} <span className="text-sm font-normal text-stone-500">· необязательно</span></h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {groupOffers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} selected={selectedAddonIds.includes(offer.id)}
                  onToggle={() => onToggleAddon(offer.id)} type="addon" />
              ))}
            </div>
          </div>
        );
      })}
      <p className="rounded-xl bg-brand-soft p-4 text-sm text-stone-700">
        Важно: выбор предложения не означает бронирование. Заявка будет отправлена только после запуска оформления заказа.
      </p>
    </section>
  );
}
