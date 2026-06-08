import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BuildModeBadge } from "@/components/backoffice/BuildModeBadge";
import { getBuildInfo } from "@/lib/system/buildInfo";

function ValueRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-medium text-foreground">
        {value || "—"}
      </p>
    </div>
  );
}

export default function AdminSystemBuildPage() {
  const buildInfo = getBuildInfo();

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminPageHeader
        title="Сборка"
        subtitle="Текущая версия приложения, окружение и параметры деплоя"
        backHref="/admin"
      />

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Режим приложения</CardTitle>
              <CardDescription>
                Read-only диагностика текущей сборки и runtime-окружения
              </CardDescription>
            </div>
            <BuildModeBadge buildInfo={buildInfo} compact />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ValueRow label="Режим приложения" value={buildInfo.label} />
          <ValueRow label="Raw APP_ENV" value={buildInfo.rawAppEnv} />
          <ValueRow label="Версия приложения" value={`v${buildInfo.appVersion}`} />
          <ValueRow label="Commit" value={buildInfo.commitSha} />
          <ValueRow label="Branch" value={buildInfo.branch} />
          <ValueRow label="Build time" value={buildInfo.buildTime} />
          <ValueRow label="Node env" value={buildInfo.nodeEnv} />
          <ValueRow label="Vercel env" value={buildInfo.vercelEnv} />
          <ValueRow label="Public URL" value={buildInfo.publicUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
