/**
 * Статический контракт (в репозитории нет jsdom) для общего поля адреса на мобильных.
 * Запуск: npx tsx src/components/address/addressSuggestInput.wiringContract.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const shared = read("./AddressSuggestInput.tsx");
const eventInput = read("../business/wizard/event/steps/location/EventLocationSearchInput.tsx");
const placeInput = read("../business/place/PlaceSearchInput.tsx");
const quick = read("../business/wizard/event/steps/location/QuickPlaceCreate.tsx");
const client = read("../../services/googleMaps/addressSuggestionsClient.ts");

// Один общий компонент: обе обёртки используют его, виджета Google (ломал мобильный ввод) нет нигде.
assert.match(eventInput, /import \{ AddressSuggestInput \} from "@\/components\/address\/AddressSuggestInput"/);
assert.match(placeInput, /import \{ AddressSuggestInput \} from "@\/components\/address\/AddressSuggestInput"/);
for (const [name, src] of [["shared", shared], ["event", eventInput], ["place", placeInput], ["quick", quick], ["client", client]] as const) {
  assert.doesNotMatch(src, /new\s+[\w.]*PlaceAutocompleteElement\(|createElement\(["']gmp-/, `${name}: no Google web-component widget`);
}
assert.ok(!existsSync(new URL("../../services/googleMaps/placeAutocompleteWidgetStyle.ts", import.meta.url)), "dead widget styles are removed");
assert.doesNotMatch(quick, /\beagerInit\b/, "no swap-on-focus workaround left in quick create");
assert.match(quick, /<EventLocationSearchInput/, "quick create keeps using the shared address component");

// Мобильная вёрстка: 16px (без автозума iOS), строки списка ≥44px, список не забирает фокус у поля.
assert.match(shared, /text-base[^"]*md:text-sm/, "input is 16px on mobile, 14px from md");
assert.match(shared, /min-h-11/, "suggestion rows are at least 44px tall");
assert.match(shared, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/, "tapping the list keeps focus (keyboard stays open)");
assert.match(shared, /max-h-64 overflow-y-auto/, "list scrolls instead of growing the page");

// Подсказки подсвечивают совпадение и работают с клавиатурой.
assert.match(shared, /<mark[^>]*font-semibold/, "matched fragment is highlighted");
assert.match(shared, /role="combobox"[\s\S]*?role="listbox"[\s\S]*?role="option"/);
assert.match(shared, /aria-activedescendant/);

// Ввод никогда не навигирует: Enter всегда подавляется, роутера нет.
assert.match(shared, /case "Enter":[\s\S]*?event\.preventDefault\(\)/);
assert.doesNotMatch(shared, /useRouter|router\.(push|replace)|window\.location|location\.href/);
assert.doesNotMatch(client, /useRouter|router\.(push|replace)|window\.location|location\.href/);

// Нагрузка и стоимость: debounce, минимум символов, защита от устаревших ответов, сессионный токен.
assert.match(shared, /ADDRESS_SUGGEST_DEBOUNCE_MS/);
assert.match(shared, /shouldQuerySuggestions\(next\)/);
assert.match(shared, /requestId !== requestIdRef\.current/);
assert.match(shared, /setOpen\(isFocusedRef\.current\)/, "late results never open the list after the user left the field");
assert.match(shared, /isResolvingRef\.current\) return/, "double tap does not start two selections");
assert.match(client, /new placesLib\.AutocompleteSessionToken\(\)/);
assert.match(client, /session\.token = undefined/, "billing session ends after a selection");
assert.match(client, /language: "ru",\s*region: "by"/);
for (const pattern of [/new\s+[\w.]+\.Autocomplete\(/, /google\.maps\.places\.Autocomplete\b/, /\bAutocompleteService\b/, /\bPlacesService\b/]) {
  assert.doesNotMatch(client, pattern, `legacy Places API ${pattern} is blocked for this Google Cloud project`);
}
assert.doesNotMatch(client, /includedRegionCodes|includedPrimaryTypes/, "worldwide search, no country filter");

// Выбор сохраняет координаты и id места; ручной ввод у PlaceSearchInput не сбрасывает их при выборе.
assert.match(eventInput, /lat: place\.lat,\s*lng: place\.lng,/);
assert.match(eventInput, /googlePlaceId: place\.googlePlaceId/);
assert.match(placeInput, /toLegacyAddressComponents\(place\.addressComponents\)/);
assert.doesNotMatch(
  placeInput.slice(placeInput.indexOf("onSelect=")),
  /onInputChange\?\.\(/,
  "selecting a suggestion must not fire onInputChange (it would wipe fresh coordinates)",
);

console.log("addressSuggestInput.wiringContract.test.ts: OK");
