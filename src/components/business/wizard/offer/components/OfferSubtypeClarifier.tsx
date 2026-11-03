"use client";

import { getOfferTypeSelection } from "../offerTypeChoices";
import type { OfferFormData, OfferProductType } from "../types";

type Group = "classes" | "parties";

const choices: Record<Group, Array<{type: OfferProductType; title: string; detail: string}>> = {
  classes: [
    {type:"ONE_TIME_ACTIVITY", title:"В конкретную дату", detail:"Мастер-класс или разовое занятие"},
    {type:"REGULAR_ACTIVITY", title:"Регулярно", detail:"Кружок, секция или курс по расписанию"},
  ],
  parties: [
    {type:"PARTY_SERVICE", title:"Отдельная услуга", detail:"Аниматор, шоу или другой исполнитель"},
    {type:"PARTY_PACKAGE", title:"Готовая программа", detail:"Пакет из нескольких услуг"},
  ],
};

/** Changes only classification fields. Never erases title, description or media. */
export function OfferSubtypeClarifier({group,data,onChange}:{
  group: Group;
  data: OfferFormData;
  onChange: (patch: (prev: OfferFormData) => Partial<OfferFormData>) => void;
}) {
  return <section className="space-y-3 rounded-xl border p-4">
    <h3 className="text-base font-semibold">{group === "classes" ? "Как проходят занятия?" : "Что именно предлагаете?"}</h3>
    <p className="text-sm text-muted-foreground">Это можно изменить без повторного заполнения названия, описания и фотографий.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {choices[group].map(item=><button type="button" key={item.type}
        aria-pressed={data.productType===item.type}
        className={`rounded-xl border p-3 text-left transition-colors ${data.productType===item.type?"border-primary bg-primary/5":"border-border"}`}
        onClick={()=>onChange(prev=>({
          ...getOfferTypeSelection(item.type),
          ...(item.type==="CAMP"?{schedule:{...prev.schedule,bookingMethod:"REQUEST_ONLY" as const}}:{}),
        }))}>
        <span className="block font-medium">{item.title}</span>
        <span className="block text-sm text-muted-foreground">{item.detail}</span>
      </button>)}
    </div>
  </section>;
}
