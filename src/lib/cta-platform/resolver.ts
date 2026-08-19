import {
  EventCtaAdapter,
  type EventCtaLegacyInput,
} from "./adapters/eventCtaAdapter";
import {
  OfferCtaAdapter,
  type OfferCtaLegacyInput,
} from "./adapters/offerCtaAdapter";
import {
  PlaceCtaAdapter,
  type PlaceCtaLegacyInput,
} from "./adapters/placeCtaAdapter";
import type { CanonicalCtaObject } from "./types";

export type CanonicalCtaResolutionInput =
  | {
      entityType: "EVENT";
      entity: EventCtaLegacyInput;
    }
  | {
      entityType: "OFFER";
      entity: OfferCtaLegacyInput;
    }
  | {
      entityType: "PLACE";
      entity: PlaceCtaLegacyInput;
    };

export function resolveCanonicalCta(
  input: CanonicalCtaResolutionInput,
): CanonicalCtaObject {
  switch (input.entityType) {
    case "EVENT":
      return EventCtaAdapter.toCanonical(input.entity);
    case "OFFER":
      return OfferCtaAdapter.toCanonical(input.entity);
    case "PLACE":
      return PlaceCtaAdapter.toCanonical(input.entity);
  }
}
