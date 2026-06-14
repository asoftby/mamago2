import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EditorialRequestMatchesResult } from "@/server/editorial/editorialRequestMatchingService";

export function EditorialRequestMatchesPanel({
  matches,
}: {
  matches: EditorialRequestMatchesResult;
}) {
  return (
    <Card className="rounded-3xl border-stone-200/80">
      <CardHeader>
        <CardTitle>Preview matched businesses</CardTitle>
        <CardDescription>
          {matches.cityScopeLabel}. Grouping is by business, while match reasons are built from published offers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!matches.criteriaSelected ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-6 text-sm text-stone-600">
            Выберите discovery signals или class chips и сохраните запрос, чтобы увидеть preview.
          </div>
        ) : matches.businesses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-5 py-6 text-sm text-stone-600">
            Под текущие критерии не найдено ни одного бизнеса с опубликованными офферами.
          </div>
        ) : (
          <div className="space-y-4">
            {matches.businesses.map((business) => (
              <div
                key={business.businessId}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-stone-900">
                        {business.businessName}
                      </h3>
                      <Badge variant="secondary" className="rounded-full">
                        {business.matchedOfferCount} offers
                      </Badge>
                    </div>
                    <div className="text-sm text-stone-600">
                      {business.ownerEmail ? `Owner: ${business.ownerEmail}` : "Owner email not set"}
                    </div>
                    <div className="text-sm text-stone-600">
                      {business.businessPhone ? `Phone: ${business.businessPhone}` : "Business phone not set"}
                    </div>
                    <div className="text-sm text-stone-600">
                      Places: {business.places.map((place) => place.title).join(", ")}
                    </div>
                  </div>

                  <div className="min-w-[220px] rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
                    <div className="font-medium text-stone-900">Match reason</div>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-stone-700">
                      {business.matchReason}
                    </pre>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {business.matchedOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-stone-900">{offer.title}</div>
                        <Badge variant="outline" className="rounded-full">
                          {offer.status}
                        </Badge>
                        <span className="text-sm text-stone-500">
                          {offer.placeTitle}
                          {offer.cityName ? ` · ${offer.cityName}` : ""}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {offer.matchedDiscoverySignals.map((signal) => (
                          <Badge
                            key={signal.id}
                            variant="secondary"
                            className="rounded-full"
                          >
                            signal: {signal.title}
                          </Badge>
                        ))}
                        {offer.matchedClassChips.map((chip) => (
                          <Badge
                            key={chip.slug}
                            variant="secondary"
                            className="rounded-full"
                          >
                            chip: {chip.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
