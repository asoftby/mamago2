/**
 * Shared visual styling for google.maps.places.PlaceAutocompleteElement.
 *
 * The widget's outer field (border/background/radius/padding) has no exposed
 * ::part() hook — verified by testing a wide set of candidate part names
 * (field, container, text-field, outline, wrapper, root, surface, icon,
 * prefix, suffix, leading-icon, clear-button, search-icon, input-field — none
 * matched). Only `input` (the bare text field) is real. So instead of the
 * mamaGo wrapper owning the border, the widget's own field becomes the single
 * visual surface: `color-scheme: light` (inherits into the shadow DOM) flips
 * it from Google's dark default theme to a light field with a rounded-md-like
 * radius, and an explicit host height keeps it aligned with mamaGo's ~40px
 * inputs. Callers must not render their own bordered wrapper around the host
 * once the widget is mounted, or the double-border problem comes back.
 */
export function placeAutocompleteWidgetStyles(className: string): string {
  return `
    .${className} {
      color-scheme: light;
      display: block;
      width: 100%;
      height: 40px;
    }

    .${className}::part(input) {
      font-size: 14px;
      color: #1f1f1f;
    }

    .${className}::part(predictions) {
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(31, 31, 31, 0.12);
    }

    .${className}::part(prediction-item) {
      background-color: #ffffff;
      color: #1f1f1f;
    }

    .${className}::part(prediction-item-match) {
      color: #1f1f1f;
    }

    .${className}::part(prediction-item-selected) {
      background-color: #f3f4f6;
      color: #1f1f1f;
    }

    .${className}::part(prediction-item-icon) {
      color: #6b6b6b;
    }
  `;
}
