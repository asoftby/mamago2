import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { listBusinessActivities } from "@/server/services/activity.service";
import { Container } from "@/components/ui/Container";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/surface";
import { H1, Body } from "@/components/ui/typography";

export default async function BusinessActivitiesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/login");
  }

  const business = await getMyBusiness(user.id);
  if (!business) {
    redirect("/business/onboarding");
  }

  const activities = await listBusinessActivities(business.id);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <H1>Мероприятия</H1>
            <Link href="/activities/new">
              <PrimaryButton>Создать мероприятие</PrimaryButton>
            </Link>
          </div>

          {/* Activities List */}
          {activities.length > 0 ? (
            <div className="grid gap-4">
              {activities.map((activity) => (
                <Surface key={activity.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-foreground mb-2">
                        {activity.title}
                      </h2>
                        {activity.shortDesc && (
                        <Body className="text-muted-foreground mb-3">
                          {activity.shortDesc}
                        </Body>
                      )}
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {activity.ageMinMonths !== null && <span>Возраст: {Math.floor(activity.ageMinMonths / 12)}+</span>}
                        {activity.priceFrom !== null && (
                          <span>
                            от {activity.priceFrom} {activity.currency}
                          </span>
                        )}
                        {activity.sessions.length > 0 && (
                          <span>Сеансов: {activity.sessions.length}</span>
                        )}
                      </div>
                    </div>
                    <Link href={`/activities/${activity.id}/edit`}>
                      <PrimaryButton size="sm">Редактировать</PrimaryButton>
                    </Link>
                  </div>
                </Surface>
              ))}
            </div>
          ) : (
            <Surface className="p-12">
              <div className="text-center space-y-4">
                <Body className="text-muted-foreground text-lg">
                  У вас пока нет мероприятий
                </Body>
                <Link href="/activities/new">
                  <PrimaryButton>Создать первое мероприятие</PrimaryButton>
                </Link>
              </div>
            </Surface>
          )}
        </div>
      </Container>
    </div>
  );
}
