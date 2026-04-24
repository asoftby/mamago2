import { StoryCalendarCover } from "../StoryCalendarCover";
import { getWeekendLabel } from "@/lib/date/storyDates";

export function WeekendStory({ onClick }: { onClick?: () => void }) {
  const weekend = getWeekendLabel();

  return (
    <StoryCalendarCover
      title="Выходные"
      main={weekend.days}
      sub={weekend.month}
      onClick={onClick}
    />
  );
}
