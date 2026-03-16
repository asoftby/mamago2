import type { ScheduleEditorValue } from "./types";

/**
 * Mock data for schedule editor demo
 */

export const mockScheduleData: ScheduleEditorValue = {
  dates: [
    {
      id: "date-1",
      isoDate: "2026-03-18",
      label: "18 марта, ср",
      slots: [
        {
          id: "slot-1",
          startTime: "10:00",
          endTime: "10:45",
          capacity: 6,
        },
        {
          id: "slot-2",
          startTime: "12:00",
          endTime: "12:45",
          capacity: 6,
        },
        {
          id: "slot-3",
          startTime: "17:00",
          endTime: "17:45",
          capacity: 6,
        },
      ],
    },
    {
      id: "date-2",
      isoDate: "2026-03-19",
      label: "19 марта, чт",
      slots: [
        {
          id: "slot-4",
          startTime: "11:00",
          endTime: "11:45",
          capacity: 8,
        },
        {
          id: "slot-5",
          startTime: "13:00",
          endTime: "13:45",
          capacity: 8,
        },
      ],
    },
    {
      id: "date-3",
      isoDate: "2026-03-20",
      label: "20 марта, пт",
      slots: [],
    },
  ],
};
