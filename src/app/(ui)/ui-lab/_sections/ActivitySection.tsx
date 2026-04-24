"use client";

import React from "react";
import { DemoSection } from "../_components/DemoSection";
import { InventoryGrid } from "../_components/InventoryGrid";
import { RenderSafe } from "../_components/RenderSafe";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { toast } from "@/lib/toast";

export function ActivitySection() {
  const handleSaveResult = (result: SaveToPlanResult, cardName: string) => {
    if (result.action === "plan") {
      const dateLabel = result.dateISO ? new Date(result.dateISO).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "";
      toast.success(`Добавлено в план${dateLabel ? ` на ${dateLabel}` : ""}`);
      console.log(`[${cardName}] Plan:`, result);
    } else if (result.action === "ideas") {
      toast.success("Сохранено в идеи");
      console.log(`[${cardName}] Ideas:`, result);
    }
  };

  return (
    <DemoSection id="activity" title="Activity Components" description="src/components/activity">
      <InventoryGrid>
        <RenderSafe title="ActivityCard with SaveToPlanModal" file="src/components/activity/ActivityCard.tsx">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-1 md:gap-6">
            {/* Case A: Confirm - Single date + single time */}
            <ActivityCard 
              id="event-1"
              title="Жаночы дзень"
              image="/mock/activity/zanocy-dzen.svg"
              age="0+"
              dateLabel="8 марта"
              priceLabel="Минск • Дукорский маёнтак"
              saveMeta={{
                title: "Жаночы дзень",
                dateISO: "2026-03-08",
                dateLabel: "8 марта",
                timeLabel: "18:00",
              }}
              onSaveResult={(result) => handleSaveResult(result, "Confirm")}
            />

            {/* Case B: Timeslots - Multiple times */}
            <ActivityCard 
              id="workshop-1"
              title="Мастер-класс по робототехнике"
              image="/mock/activity/zanocy-dzen.svg"
              age="6+"
              dateLabel="9 марта"
              priceLabel="от 25 BYN"
              saveMeta={{
                title: "Мастер-класс по робототехнике",
                dateISO: "2026-03-09",
                dateLabel: "9 марта",
                timeSlots: [
                  { id: "t10", label: "10:00" },
                  { id: "t13", label: "13:00" },
                  { id: "t18", label: "18:00" },
                ],
              }}
              onSaveResult={(result) => handleSaveResult(result, "Timeslots")}
            />

            {/* Case C: Quickdate - No date/time */}
            <ActivityCard 
              id="place-1"
              title="Семейное кафе «Андерсон»"
              image="/mock/activity/anderson.svg"
              badge="Популярное"
              age="0+"
              dateLabel="10:00–22:00"
              priceLabel="от 30 BYN"
              rating={4.8}
              saveMeta={{
                title: "Семейное кафе «Андерсон»",
              }}
              onSaveResult={(result) => handleSaveResult(result, "Quickdate")}
            />
          </div>
        </RenderSafe>

        <RenderSafe title="ActivityGrid" file="src/components/activity/ActivityGrid.tsx" listedOnly />
        <RenderSafe title="CityFeedClient" file="src/components/activity/CityFeedClient.tsx" listedOnly />
      </InventoryGrid>
    </DemoSection>
  );
}
