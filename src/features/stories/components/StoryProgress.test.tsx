import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { StoryProgress } from "./StoryProgress";

const pausedHtml = renderToStaticMarkup(
  <StoryProgress
    total={3}
    current={1}
    progressKey={7}
    paused
    durationMs={5000}
  />,
);

assert.match(
  pausedHtml,
  /animation-play-state:paused/,
  "paused story progress must stop the active CSS animation",
);

const runningHtml = renderToStaticMarkup(
  <StoryProgress
    total={3}
    current={1}
    progressKey={8}
    paused={false}
    durationMs={5000}
  />,
);

assert.match(
  runningHtml,
  /animation-play-state:running/,
  "resumed story progress must continue the active CSS animation",
);

console.log("StoryProgress tests: OK");
