export type AiDescriptionEntityType = "event" | "place" | "offer";

export type AiDescriptionAction =
  | "generate"
  | "improve"
  | "shorten"
  | "warm"
  | "sell";

export type AiDescriptionContextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean | null | undefined>;

export type AiDescriptionContext = Record<string, AiDescriptionContextValue>;

export const AI_DESCRIPTION_ACTION_LABELS: Record<AiDescriptionAction, string> = {
  generate: "Сгенерировать описание",
  improve: "Улучшить",
  shorten: "Сделать короче",
  warm: "Сделать теплее",
  sell: "Сделать продающе",
};

export function normalizeAiDescriptionContext(
  context: AiDescriptionContext | undefined,
): Record<string, string> {
  if (!context) return {};

  return Object.fromEntries(
    Object.entries(context)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          const items = value
            .map((item) => (item == null ? "" : String(item).trim()))
            .filter(Boolean);
          return [key, items.join(", ")] as const;
        }

        const normalized = value == null ? "" : String(value).trim();
        return [key, normalized] as const;
      })
      .filter(([, value]) => value.length > 0),
  );
}
