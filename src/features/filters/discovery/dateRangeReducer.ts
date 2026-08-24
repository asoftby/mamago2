export type DateRangeDraft = { from: string | null; to: string | null; selectingEnd: boolean };
export type DateRangeAction =
  | { type: "select"; date: string; today: string }
  | { type: "reset" }
  | { type: "hydrate"; from: string | null; to: string | null };

export const emptyDateRangeDraft: DateRangeDraft = { from: null, to: null, selectingEnd: false };

export function dateRangeReducer(state: DateRangeDraft, action: DateRangeAction): DateRangeDraft {
  if (action.type === "reset") return emptyDateRangeDraft;
  if (action.type === "hydrate") {
    return { from: action.from, to: action.to ?? action.from, selectingEnd: false };
  }
  if (action.date < action.today) return state;
  if (!state.from || !state.selectingEnd || action.date < state.from) {
    return { from: action.date, to: action.date, selectingEnd: true };
  }
  return { from: state.from, to: action.date, selectingEnd: false };
}
