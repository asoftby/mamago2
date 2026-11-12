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
assert.match(shared, /overflow-y-auto overscroll-contain/, "list scrolls instead of growing the page");
// Открытая клавиатура: высота по visualViewport, прокрутка страницы к списку, обновление при resize.
assert.match(shared, /window\.visualViewport/);
assert.match(shared, /computeSuggestListMaxHeight\(/);
assert.match(shared, /scrollIntoView\(\{ block: "nearest" \}\)/);
assert.match(shared, /viewport\?\.addEventListener\("resize", fit\)/);
assert.match(shared, /style=\{\{ maxHeight: listMaxHeight \}\}/);
// Введённый текст принадлежит обёртке (value) и не сбрасывается ни поиском, ни закрытием списка.
assert.doesNotMatch(shared, /onValueChange\(""\)/, "the component never clears what the user typed");

// Атрибуция Google (требования Google Maps Platform): текст «Google Maps» ≥12px, цвет #5E5E5E,
// без переноса/перевода, внутри того же контейнера внизу, отделён границей. Старая подпись удалена.
const attribution = shared.match(/<p\s[^>]*translate="no"[\s\S]*?<\/p>/)?.[0] ?? "";
assert.match(attribution, />\s*Google Maps\s*</, "text is exactly «Google Maps»");
assert.match(attribution, /text-xs/, "12px (Google minimum for the text form)");
assert.match(attribution, /text-\[#5E5E5E\]/, "an allowed Google attribution color with ≥4.5:1 contrast on white");
assert.match(attribution, /whitespace-nowrap/, "never wraps");
assert.match(attribution, /border-t/, "separated from the suggestions");
for (const cls of ["font-sans", "font-normal", "tracking-normal"]) assert.match(attribution, new RegExp(`\\b${cls}\\b`), `attribution uses ${cls}`);
assert.doesNotMatch(shared, /Powered by Google|text-\[10px\]/, "non-compliant legacy label is gone");
assert.ok(shared.indexOf("Google Maps\n") > shared.indexOf('role="listbox"'), "attribution sits below the list, inside the panel");

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
// Ревью: поздний поиск после выбора не оставляет «мёртвый» список; размонтированное поле не уведомляет родителя.
assert.match(shared, /sessionRef\.current !== session\) return/, "results of an already ended session are dropped");
assert.match(shared, /requestIdRef\.current \+= 1; \/\/ поиск, запущенный во время выбора/, "a successful selection invalidates in-flight searches");
assert.match(shared, /requestIdRef\.current \+= 1; \/\/ поиск, запущенный во время выбора[\s\S]*?clearTimeout\(debounceRef\.current\)/, "...and cancels a pending debounced search typed while the selection resolved");
assert.match(shared, /if \(!isMountedRef\.current\) return;/, "no onSelect after unmount");
assert.match(shared, /aria-controls=\{showPanel \? listboxId : undefined\}/, "aria-controls never points to a missing element");
assert.match(shared, /role="status"[\s\S]*?role="alert"/, "status and error messages are announced");
assert.match(shared, /current === "empty" \|\| current === "error" \? "loading" : current/, "a stale empty/error message is replaced by «searching» as soon as the user types");
assert.match(client, /new placesLib\.AutocompleteSessionToken\(\)/); // поведение — в addressSuggestionsClient.test.ts
// Сессия поиска: один токен на сессию (не на запрос), завершается fetchFields() при ЛЮБОМ исходе.
assert.match(client, /if \(!session\.token && placesLib\.AutocompleteSessionToken\)/, "token is created once per session, not per request");
assert.match(client, /try \{[\s\S]*?place\.fetchFields\([\s\S]*?\} finally \{[\s\S]*?session\.token = undefined;/, "token is discarded even if fetchFields fails");
assert.doesNotMatch(client, /fetchFields\([^)]*sessionToken/, "sessionToken is not passed to fetchFields (the session rides on the prediction)");
// Платные поля: только Essentials; displayName (Place Details Pro) не запрашивается — подпись берётся из подсказки.
assert.match(client, /fields: \["id", "formattedAddress", "location", "addressComponents"\]/);
assert.doesNotMatch(client, /fields:[^\]]*displayName/, "no Pro-tier field in fetchFields");
assert.match(client, /prediction\.mainText\?\.text/);
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
