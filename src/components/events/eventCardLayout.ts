/** Оболочка ширины карточки события — как в ленте «Куда» на главной. */
export const EVENT_CARD_SHELL =
  "shrink-0 snap-start w-[44vw] min-w-[160px] max-w-[230px] sm:max-w-[250px] " +
  "lg:w-[calc((100%-4.5rem)/4)] lg:max-w-none";

/** Mirrors EVENT_CARD_SHELL so Next/Image selects the smallest useful source candidate. */
export const EVENT_CARD_IMAGE_SIZES =
  "(min-width: 1200px) 266px, (min-width: 1024px) calc((100vw - 136px) / 4), " +
  "(min-width: 568px) 250px, 44vw";
