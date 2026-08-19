import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { BookingEmptyStateActions } from "./BookingEmptyStateActions";

function renderActions() {
  return renderToStaticMarkup(
    <BookingEmptyStateActions classesButtonClassName="classes-button" kudaButtonClassName="kuda-button" />,
  );
}

const originalNavigationEnabled = DISCOVERY_INTENT_CONFIG.classes.navigationEnabled;

try {
  DISCOVERY_INTENT_CONFIG.classes.navigationEnabled = false;
  const navigationDisabledHtml = renderActions();

  assert.doesNotMatch(navigationDisabledHtml, /Найти занятия/);
  assert.match(navigationDisabledHtml, /Куда пойти/);
  assert.match(navigationDisabledHtml, /href="\/minsk\/events"/);

  DISCOVERY_INTENT_CONFIG.classes.navigationEnabled = true;
  const navigationEnabledHtml = renderActions();

  assert.match(navigationEnabledHtml, /Найти занятия/);
  assert.match(navigationEnabledHtml, /Куда пойти/);
} finally {
  DISCOVERY_INTENT_CONFIG.classes.navigationEnabled = originalNavigationEnabled;
}

console.log("ParentBookingsClient empty-state tests passed");
