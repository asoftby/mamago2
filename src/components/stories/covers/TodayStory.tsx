import { StoryCalendarCover } from "../StoryCalendarCover";
import { getTodayLabel } from "@/lib/date/storyDates";

export function TodayStory({ onClick }: { onClick?: () => void }) {
  const today = getTodayLabel();

  return (
    <StoryCalendarCover
      title="Сегодня"
      main={today.day}
      sub={today.month}
      onClick={onClick}
    />
  );
}
