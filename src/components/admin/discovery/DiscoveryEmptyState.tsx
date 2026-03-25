import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DiscoveryEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed border-gray-200 bg-gray-50/50">
      <CardHeader>
        <CardTitle className="text-base font-medium text-gray-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );
}
