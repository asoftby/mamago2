import type { PackageChangeScope } from "@/lib/birthday/packageChangeScope";

const labels = { KEPT: "Остаётся", REMOVED: "Убрать", REPLACED: "Заменить" };
function price(value: PackageChangeScope["originalPrice"]) {
  return value.amountByn === null ? "Стоимость по согласованию" :
    (value.mode === "FROM" ? "от " : "") + value.amountByn + " BYN";
}
/** Shared view of the frozen request; a quote describes this package seller's obligations only. */
export function PartyPackageBrief({ scope }: { scope: PackageChangeScope }) {
  return <div className="space-y-2 rounded-xl border border-border p-3 text-sm" data-testid="package-change-brief">
    <p className="font-semibold">Запрошенный состав пакета</p>
    {scope.comment ? <p>Комментарий родителя: {scope.comment}</p> : null}
    <p>Исходный пакет: {scope.packageTitle} · {price(scope.originalPrice)}</p>
    <ul className="space-y-1">
      {scope.components.map(component => <li key={component.itemId} className="break-words">
        {labels[component.action]}: {component.snapshot.title}
        {component.creditByn !== "0.00" ? ` · уменьшение ${component.creditByn} BYN` : ""}
        {component.requiresQuote ? " · изменение требует согласования стоимости" : ""}
      </li>)}
    </ul>
    <p>Оценка в исходном запросе: {price(scope.requestedPrice)}. Цена и условия пакета — в предложении исполнителя. Подтверждение бронирования выполняется отдельно.</p>
    {scope.standalone.length > 0 ? <div>
      <p className="font-medium">Самостоятельные услуги — отдельное согласование</p>
      <ul>{scope.standalone.map(item => <li key={item.itemId} className="break-words">{item.title} · {price(item.price)}</li>)}</ul>
      <p className="text-muted-foreground">Ответ владельца пакета не подтверждает цену и доступность других исполнителей.</p>
    </div> : null}
  </div>;
}
