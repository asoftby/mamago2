import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImprovementRequestForm } from "@/components/admin/moderation/ImprovementRequestForm";
import { ImprovementRequestList } from "@/components/admin/moderation/ImprovementRequestList";
import { loadImprovementRequestsForPlace } from "./placeModerationQueries";

export async function ImprovementRequestsBlock({ placeId }: { placeId: string }) {
  const improvementRequests = await loadImprovementRequestsForPlace(placeId);

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Запросы на доработку</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Создать запрос</CardTitle>
          </CardHeader>
          <CardContent>
            <ImprovementRequestForm placeId={placeId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История запросов</CardTitle>
          </CardHeader>
          <CardContent>
            {improvementRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Запросов на доработку пока нет</p>
              </div>
            ) : (
              <ImprovementRequestList requests={improvementRequests as any} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
