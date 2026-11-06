import { partyTariffConditions, type PartyTariffConditions as Conditions } from "@/lib/offers/partyTariff";
import { Input } from "@/components/ui/input";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const time = (value: number | undefined) => value === undefined ? "" :
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const minutes = (value: string) => value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : undefined;

export function PartyTariffConditions({ value, onChange, disabled, components }: {
  value?: Conditions;
  onChange: (value?: Conditions) => void;
  disabled: boolean;
  components?: readonly { id?: string; title: string; isOptional?: boolean }[];
}) {
  const update = (patch: Partial<Conditions>) => { if (value) onChange({ ...value, ...patch }); };
  const numberField = (label: string, key: "durationMinutes" | "minAgeMonths" | "maxAgeMonths" | "minGuests" | "maxGuests") => (
    <label className="space-y-1 text-sm">
      <span>{label}</span>
      <Input type="number" min={key === "durationMinutes" ? 1 : 0} step={1} value={value?.[key] ?? ""}
        onChange={event => update({ [key]: event.target.value === "" ? key === "durationMinutes" ? 0 : undefined : event.target.valueAsNumber })} />
    </label>
  );
  return <fieldset disabled={disabled} className="mt-4 space-y-3 rounded-md border p-3">
    <legend className="px-1 text-sm font-medium">Когда действует эта цена</legend>
    <label className="flex gap-2 text-sm">
      <input type="checkbox" checked={!!value} onChange={event =>
        onChange(event.target.checked ? { durationMinutes: 0, ...(components ? { componentIds: components.flatMap(c => c.id && !c.isOptional ? [c.id] : []) } : {}) } : undefined)} />
      Указать условия
    </label>
    {value && <>
      <p className="text-xs text-muted-foreground">Длительность обязательна. Остальные поля можно оставить пустыми. Время указано по Минску.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">С даты<Input type="date" value={value.dateFrom ?? ""} onChange={e => update({ dateFrom: e.target.value || undefined })} /></label>
        <label className="space-y-1 text-sm">По дату<Input type="date" value={value.dateTo ?? ""} onChange={e => update({ dateTo: e.target.value || undefined })} /></label>
        <label className="space-y-1 text-sm">Начало не раньше<Input type="time" value={time(value.startMinutes)} onChange={e => update({ startMinutes: minutes(e.target.value) })} /></label>
        <label className="space-y-1 text-sm">Окончание не позже<Input type="time" value={time(value.endMinutes)} onChange={e => update({ endMinutes: minutes(e.target.value) })} /></label>
        {numberField("Длительность, минут", "durationMinutes")}
        {numberField("Минимум гостей", "minGuests")}
        {numberField("Максимум гостей", "maxGuests")}
        {numberField("Возраст от, месяцев", "minAgeMonths")}
        {numberField("Возраст до, месяцев", "maxAgeMonths")}
      </div>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Дни недели">
        {weekdays.map((label, index) => <label key={label} className="flex gap-1 text-sm">
          <input type="checkbox" checked={value.weekdays?.includes(index + 1) ?? false} onChange={e => {
            const next = (value.weekdays ?? []).filter(day => day !== index + 1);
            if (e.target.checked) next.push(index + 1);
            update({ weekdays: next.length ? next.sort() : undefined });
          }} />{label}
        </label>)}
      </div>
      {components && <div className="space-y-1" role="group" aria-label="Состав пакета">
        <p className="text-sm">Услуги, включённые в эту цену</p>
        {components.map((component, index) => <label key={component.id ?? index} className="flex gap-2 text-sm">
          <input type="checkbox" disabled={!component.id} checked={!!component.id && value.componentIds?.includes(component.id)} onChange={e => {
            if (!component.id) return;
            const next = (value.componentIds ?? []).filter(id => id !== component.id);
            if (e.target.checked) next.push(component.id);
            update({ componentIds: next });
          }} />{component.title}{!component.id && " (сначала сохраните пакет)"}
        </label>)}
      </div>}
      {!partyTariffConditions.safeParse(value).success && <p role="alert" className="text-sm text-destructive">Укажите длительность и проверьте границы условий.</p>}
    </>}
  </fieldset>;
}
