"use client";

import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ADDRESS_SUGGEST_DEBOUNCE_MS,
  SUGGEST_LIST_MAX_HEIGHT,
  computeSuggestListMaxHeight,
  moveActiveIndex,
  shouldQuerySuggestions,
  type AddressSuggestionView,
} from "@/lib/address/addressSuggestions";
import {
  createAddressSuggestionsSession,
  fetchAddressSuggestions,
  resolveAddressSuggestion,
  type AddressSuggestionsSession,
  type ResolvedAddressPlace,
} from "@/services/googleMaps/addressSuggestionsClient";

export type { ResolvedAddressPlace } from "@/services/googleMaps/addressSuggestionsClient";

/** Источник подсказок. По умолчанию — Google Places (New); подменяется в тестах/стендах. */
export type AddressSuggestClient = {
  createSession: () => AddressSuggestionsSession;
  fetchSuggestions: (session: AddressSuggestionsSession, input: string) => Promise<AddressSuggestionView[]>;
  resolve: (session: AddressSuggestionsSession, suggestionId: string) => Promise<ResolvedAddressPlace | null>;
};

const googleClient: AddressSuggestClient = {
  createSession: createAddressSuggestionsSession,
  fetchSuggestions: fetchAddressSuggestions,
  resolve: resolveAddressSuggestion,
};

type Status = "idle" | "loading" | "ready" | "empty" | "error";

interface AddressSuggestInputProps {
  /** Текущий текст поля (контролируется обёрткой). */
  value: string;
  /** Пользователь печатает: обёртка решает, что сделать с текстом. */
  onValueChange: (value: string) => void;
  /** Пользователь выбрал подсказку; к этому моменту уже получены координаты. */
  onSelect: (place: ResolvedAddressPlace) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  client?: AddressSuggestClient;
}

/**
 * Единое поле адреса для мастеров мест/событий/офферов и редактора статей.
 * Обычный <input> + свой список: без виджета Google, который на мобильных ломал ввод,
 * клавиатуру и подсветку. Шрифт 16px на мобильных (без автозума iOS), строки списка ≥44px,
 * Enter никогда не отправляет внешнюю форму.
 */
export const AddressSuggestInput = forwardRef<HTMLInputElement, AddressSuggestInputProps>(
  function AddressSuggestInput(
    { value, onValueChange, onSelect, disabled, placeholder = "Адрес или название места", id, client = googleClient },
    forwardedRef,
  ) {
    const listboxId = useId();
    const [suggestions, setSuggestions] = useState<AddressSuggestionView[]>([]);
    const [status, setStatus] = useState<Status>("idle");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isResolving, setIsResolving] = useState(false);
    const [selectError, setSelectError] = useState<string | null>(null);
    const [listMaxHeight, setListMaxHeight] = useState(SUGGEST_LIST_MAX_HEIGHT);
    const panelRef = useRef<HTMLDivElement>(null);

    const sessionRef = useRef<AddressSuggestionsSession | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);
    const isFocusedRef = useRef(false);
    const isResolvingRef = useRef(false);
    const clientRef = useRef(client);
    const onSelectRef = useRef(onSelect);

    useEffect(() => {
      clientRef.current = client;
      onSelectRef.current = onSelect;
    }, [client, onSelect]);

    useEffect(
      () => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        requestIdRef.current += 1;
      },
      [],
    );

    const runSearch = useCallback(async (input: string) => {
      const requestId = ++requestIdRef.current;
      setStatus("loading");
      // Если пользователь уже ушёл из поля, пока шёл debounce/запрос, список не раскрываем.
      setOpen(isFocusedRef.current);
      try {
        const activeClient = clientRef.current;
        if (!sessionRef.current) sessionRef.current = activeClient.createSession();
        const items = await activeClient.fetchSuggestions(sessionRef.current, input);
        if (requestId !== requestIdRef.current) return; // устаревший ответ
        setSuggestions(items);
        setActiveIndex(-1);
        setStatus(items.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("[AddressSuggestInput] suggestions error:", error);
        setSuggestions([]);
        setStatus("error");
      }
    }, []);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setSelectError(null);
      onValueChange(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!shouldQuerySuggestions(next)) {
        requestIdRef.current += 1;
        setSuggestions([]);
        setStatus("idle");
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(() => void runSearch(next.trim()), ADDRESS_SUGGEST_DEBOUNCE_MS);
    };

    const closeList = useCallback(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, []);

    const selectSuggestion = useCallback(
      async (suggestion: AddressSuggestionView) => {
        const session = sessionRef.current;
        if (!session || isResolvingRef.current) return; // двойной тап не запускает два выбора
        isResolvingRef.current = true;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        requestIdRef.current += 1; // отбросить запоздавшие ответы поиска
        setIsResolving(true);
        setSelectError(null);
        try {
          const place = await clientRef.current.resolve(session, suggestion.id);
          if (!place) {
            setSelectError("Не удалось получить координаты. Выберите другой вариант или точку на карте.");
            return;
          }
          sessionRef.current = null;
          setSuggestions([]);
          setStatus("idle");
          closeList();
          onSelectRef.current(place);
        } catch (error) {
          console.error("[AddressSuggestInput] resolve error:", error);
          setSelectError("Не удалось получить адрес. Попробуйте ещё раз или выберите точку на карте.");
        } finally {
          isResolvingRef.current = false;
          setIsResolving(false);
        }
      },
      [closeList],
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case "Enter":
          // Enter в поле адреса не должен отправлять внешнюю форму / уводить со страницы.
          event.preventDefault();
          if (open && activeIndex >= 0 && suggestions[activeIndex]) {
            void selectSuggestion(suggestions[activeIndex]);
          }
          break;
        case "ArrowDown":
        case "ArrowUp":
          if (suggestions.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => moveActiveIndex(current, event.key === "ArrowDown" ? "down" : "up", suggestions.length));
          }
          break;
        case "Escape":
          if (open) {
            event.preventDefault();
            closeList();
          }
          break;
        default:
      }
    };

    const showPanel = open && (status !== "idle" || suggestions.length > 0);
    const activeId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

    // Мобильная клавиатура сужает видимую область (visualViewport), а не окно: подгоняем высоту
    // списка под неё и, если списку всё равно не хватает места, прокручиваем страницу к нему.
    useEffect(() => {
      if (!showPanel) return;
      const viewport = window.visualViewport;
      const fit = () => {
        const panel = panelRef.current;
        if (!panel) return;
        const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
        setListMaxHeight(computeSuggestListMaxHeight({ visibleBottom, panelTop: panel.getBoundingClientRect().top }));
      };
      fit();
      panelRef.current?.scrollIntoView({ block: "nearest" });
      viewport?.addEventListener("resize", fit);
      viewport?.addEventListener("scroll", fit);
      window.addEventListener("resize", fit);
      return () => {
        viewport?.removeEventListener("resize", fit);
        viewport?.removeEventListener("scroll", fit);
        window.removeEventListener("resize", fit);
      };
    }, [showPanel, status, suggestions.length]);

    return (
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={forwardedRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            isFocusedRef.current = true;
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            // Список закрывается после blur; выбор по касанию не теряет фокус (см. onMouseDown ниже).
            closeList();
          }}
          className={cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-10 w-full min-w-0 rounded-md border bg-white px-3 py-2 pl-10 pr-9 text-base leading-none shadow-xs outline-none md:text-sm dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        {(status === "loading" || isResolving) && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}

        {showPanel ? (
          <div
            ref={panelRef}
            // Не отбираем фокус у поля при касании списка: клавиатура остаётся открытой.
            onMouseDown={(event) => event.preventDefault()}
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
          >
            <ul id={listboxId} role="listbox" style={{ maxHeight: listMaxHeight }} className="overflow-y-auto overscroll-contain">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  id={`${listboxId}-opt-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => void selectSuggestion(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2",
                    index === activeIndex ? "bg-gray-100" : "bg-white",
                  )}
                >
                  <span className="text-sm text-gray-700">
                    {suggestion.mainSegments.map((segment, segmentIndex) =>
                      segment.match ? (
                        <mark key={segmentIndex} className="rounded-sm bg-primary/15 font-semibold text-gray-900">
                          {segment.text}
                        </mark>
                      ) : (
                        <span key={segmentIndex}>{segment.text}</span>
                      ),
                    )}
                  </span>
                  {suggestion.secondaryText ? (
                    <span className="text-xs text-gray-500">{suggestion.secondaryText}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {status === "loading" && suggestions.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-500">Ищем адрес…</p>
            ) : null}
            {status === "empty" ? (
              <p className="px-3 py-3 text-sm text-gray-500">
                Ничего не найдено. Уточните адрес или выберите точку на карте.
              </p>
            ) : null}
            {status === "error" ? (
              <p className="px-3 py-3 text-sm text-red-600">
                Не удалось загрузить подсказки. Проверьте соединение или выберите точку на карте.
              </p>
            ) : null}
            {/* Атрибуция Google Maps Platform: текст «Google Maps» (когда места мало), 12px, #5E5E5E
                (контраст ≥ 4.5:1), без переноса/перевода, внизу того же контейнера, отделён границей. */}
            <p
              translate="no"
              className="whitespace-nowrap border-t border-gray-100 px-3 py-1.5 font-sans text-xs font-normal tracking-normal text-[#5E5E5E]"
            >
              Google Maps
            </p>
          </div>
        ) : null}

        {selectError ? <p className="mt-1 text-sm text-red-600">{selectError}</p> : null}
      </div>
    );
  },
);
