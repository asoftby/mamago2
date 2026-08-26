"use client";

import * as React from "react";
import { DemoSection } from "../_components/DemoSection";
import {
  SaveToPlanPickerBody,
  type SaveScenario,
  type SaveToPlanResult,
} from "@/components/activity/SaveToPlanModal";

const ARTICLE_TITLE = "«Гранд Бублик» — просто ожившая усадьба Гэтсби, только в Минске";
const ACTIVITY_TITLE = "Мастер-класс по лепке из глины";

const ARTICLE_SCENARIO: SaveScenario = {
  kind: "quickdate",
  title: ARTICLE_TITLE,
  ideaOnly: true,
};

const ACTIVITY_SCENARIO: SaveScenario = {
  kind: "quickdate",
  title: ACTIVITY_TITLE,
  eventPlanDateOptions: [
    "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
    "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08",
  ],
};

const VARIANTS = [
  { id: "article", label: "Article — ideaOnly", scenario: ARTICLE_SCENARIO, isIdea: false },
  { id: "article-saved", label: "Article — already saved", scenario: ARTICLE_SCENARIO, isIdea: true },
  { id: "activity", label: "Activity — dated", scenario: ACTIVITY_SCENARIO, isIdea: false },
  { id: "activity-idea", label: "Activity — already in ideas", scenario: ACTIVITY_SCENARIO, isIdea: true },
] as const;

/**
 * Live preview of the real SaveToPlanPickerBody (no network calls — onCommit
 * just echoes the result below) so Article `ideaOnly` and the untouched
 * Activity date-slider flow can be compared side by side.
 */
export function SaveModalSection() {
  const [activeId, setActiveId] = React.useState<(typeof VARIANTS)[number]["id"]>("article");
  const [lastCommit, setLastCommit] = React.useState<string | null>(null);
  const active = VARIANTS.find((v) => v.id === activeId)!;

  const handleCommit = (result: SaveToPlanResult) => {
    setLastCommit(JSON.stringify(result));
  };

  return (
    <DemoSection
      id="save-modal"
      title="Save modal — SaveToPlanPickerBody"
      description="src/components/activity/SaveToPlanModal.tsx · Article ideaOnly vs Activity dated/idea flows"
    >
      <div className="flex flex-wrap gap-2">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => { setActiveId(v.id); setLastCommit(null); }}
            className={[
              "rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              activeId === v.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {v.label}
          </button>
        ))}
      </div>

      <p className="font-mono text-[12px] text-muted-foreground">
        onCommit → {lastCommit ?? "(нажмите действие в модалке)"}
      </p>

      <div
        className="mx-auto max-w-md overflow-hidden rounded-3xl border border-border/40"
        style={{ background: "#F6F2EA" }}
      >
        <SaveToPlanPickerBody
          key={activeId}
          scenario={active.scenario}
          isIdea={active.isIdea}
          onCommit={handleCommit}
          onClose={() => {}}
        />
      </div>
    </DemoSection>
  );
}
