"use client";

interface StoryProgressProps {
  total: number;
  current: number;
  /** Changing this key restarts the fill animation on the active segment */
  progressKey: number;
  paused: boolean;
  durationMs?: number;
  /** Called when the active segment's fill animation completes */
  onComplete?: () => void;
}

export function StoryProgress({
  total,
  current,
  progressKey,
  paused,
  durationMs = 5000,
  onComplete,
}: StoryProgressProps) {
  return (
    <div className="flex gap-[3px] w-full px-3 pt-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[2.5px] flex-1 rounded-full overflow-hidden bg-white/30"
        >
          {/* Completed segments */}
          {i < current && (
            <div className="h-full w-full bg-white rounded-full" />
          )}

          {/* Active segment — animated fill */}
          {i === current && (
            <div
              key={progressKey}
              className="h-full bg-white rounded-full origin-left"
              style={{
                animationName: "storyFill",
                animationDuration: `${durationMs}ms`,
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
                animationPlayState: paused ? "paused" : "running",
              }}
              onAnimationEnd={onComplete}
            />
          )}
          {/* Future segments stay empty (bg-white/30 from parent) */}
        </div>
      ))}

      {/* Keyframe injected once */}
      <style>{`
        @keyframes storyFill {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
